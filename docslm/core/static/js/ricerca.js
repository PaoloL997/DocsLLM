/**
 * Ricerca page – document similarity search.
 *
 * Initializes a high-k Store when a collection is selected in the sidebar,
 * then lets the user run similarity queries and browse scored results.
 * Reuses the openSourceModal() function from app.js for reference previews.
 */

(function () {
    'use strict';

    let searchStoreReady = false;

    const searchInput = document.getElementById('searchDocInput');
    const searchBtn = document.getElementById('searchBtn');
    const resultsContainer = document.getElementById('ricercaResults');
    const storeStatus = document.getElementById('searchStoreStatus');

    if (!searchInput || !searchBtn || !resultsContainer) return;

    // --- Store status helpers (scoped to #searchStoreStatus) ----------------

    function showStatus(state) {
        /**
         * Toggle the visible status indicator inside the search card.
         * @param {string} state - One of 'inactive', 'loading', 'success'.
         */
        if (!storeStatus) return;
        ['agent-inactive', 'agent-loading', 'agent-success'].forEach(cls => {
            const el = storeStatus.querySelector('.' + cls);
            if (el) el.style.display = 'none';
        });
        const target = storeStatus.querySelector('.agent-' + state);
        if (target) target.style.display = 'flex';
    }

    // --- Initialize search store when a collection is selected ---------------

    document.addEventListener('collectionSelected', async (e) => {
        const { commessa, collection } = e.detail;
        showStatus('loading');
        searchStoreReady = false;
        updateSearchButton();

        try {
            const res = await fetch('/api/initialize-search-store/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({
                    commessa: commessa,
                    collection_name: collection,
                }),
            });
            const data = await res.json();
            if (data.success) {
                searchStoreReady = true;
                showStatus('success');
            } else {
                console.error('Search store init error:', data.error);
                showStatus('inactive');
            }
        } catch (err) {
            console.error('Search store init network error:', err);
            showStatus('inactive');
        }
        updateSearchButton();
    });

    // --- Search button enable / disable --------------------------------------

    function updateSearchButton() {
        /** Enable search button only when store is ready and input is non-empty. */
        const hasQuery = searchInput.value.trim().length > 0;
        if (searchStoreReady && hasQuery) {
            searchBtn.removeAttribute('disabled');
            searchBtn.classList.remove('disabled');
        } else {
            searchBtn.setAttribute('disabled', 'true');
            searchBtn.classList.add('disabled');
        }
    }

    searchInput.addEventListener('input', updateSearchButton);

    // --- Auto-resize textarea ------------------------------------------------

    searchInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });

    // --- Execute search ------------------------------------------------------

    async function executeSearch() {
        /** Send the query to the backend and render results. */
        const query = searchInput.value.trim();
        if (!query || !searchStoreReady) return;

        resultsContainer.innerHTML = '';
        showStatus('loading');
        searchBtn.setAttribute('disabled', 'true');
        searchBtn.classList.add('disabled');

        try {
            const res = await fetch('/api/search-documents/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            showStatus('success');
            updateSearchButton();

            if (data.success && Array.isArray(data.results)) {
                renderResults(data.results);
            } else {
                resultsContainer.innerHTML =
                    '<div class="ricerca-empty">Nessun risultato trovato.</div>';
            }
        } catch (err) {
            console.error('Search error:', err);
            showStatus('success');
            updateSearchButton();
            resultsContainer.innerHTML =
                '<div class="ricerca-empty">Errore durante la ricerca.</div>';
        }
    }

    searchBtn.addEventListener('click', executeSearch);

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            executeSearch();
        }
    });

    // --- Render results ------------------------------------------------------

    function renderResults(results) {
        /** Build result cards from the backend response. */
        resultsContainer.innerHTML = '';

        if (!results.length) {
            resultsContainer.innerHTML =
                '<div class="ricerca-empty">Nessun risultato trovato.</div>';
            return;
        }

        results.forEach((item, idx) => {
            const card = buildResultCard(item, idx);
            resultsContainer.appendChild(card);
        });
    }

    function buildResultCard(item, idx) {
        /**
         * Create a single result card element.
         * @param {Object} item - Result object from the backend.
         * @param {number} idx - Index of the result for labelling.
         * @returns {HTMLElement}
         */
        const card = document.createElement('div');
        card.className = 'ricerca-result-card';

        const meta = item.metadata || {};
        const name = item.name || meta.name || 'Documento';
        const docType = item.type || meta.type || 'text';
        const pageStart = item.page_start ?? meta.page_start;
        const pageEnd = item.page_end ?? meta.page_end;
        const score = item.score != null ? item.score : null;
        const content = item.content || '';

        // Header row: name + page info + score
        const header = document.createElement('div');
        header.className = 'ricerca-result-header';

        const titleEl = document.createElement('span');
        titleEl.className = 'ricerca-result-title';
        let titleText = name;
        if (pageStart != null && String(pageStart) !== 'N/A') {
            titleText += pageEnd != null && String(pageEnd) !== 'N/A' && pageEnd !== pageStart
                ? ` — pag. ${pageStart}-${pageEnd}`
                : ` — pag. ${pageStart}`;
        }
        titleEl.textContent = titleText;
        header.appendChild(titleEl);

        if (score != null) {
            const scoreEl = document.createElement('span');
            scoreEl.className = 'ricerca-result-score';
            scoreEl.textContent = `${(score * 100).toFixed(1)}%`;
            header.appendChild(scoreEl);
        }

        card.appendChild(header);

        // Type badge
        const typeBadge = document.createElement('span');
        typeBadge.className = 'ricerca-result-type';
        typeBadge.textContent = docType;
        card.appendChild(typeBadge);

        // Content preview
        if (content) {
            const preview = document.createElement('p');
            preview.className = 'ricerca-result-content';
            preview.textContent = content.length > 300
                ? content.slice(0, 300) + '…'
                : content;
            card.appendChild(preview);
        }

        // Click opens source modal (reuses openSourceModal from app.js)
        card.addEventListener('click', () => {
            if (typeof openSourceModal === 'function') {
                openSourceModal({
                    label: String(idx + 1),
                    name: name,
                    type: docType,
                    page_start: pageStart,
                    page_end: pageEnd,
                    index: idx,
                    metadata: meta,
                });
            }
        });

        return card;
    }
})();
