/**
 * Cronologia page – history browser with inline commessa selector.
 */

(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────────────────────
    let selectedCommessa = null;
    let searchTimeout = null;
    let allItems = [];

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const commessaInput   = document.getElementById('commessaSearchInput');
    const commessaBar     = document.getElementById('commessaBar');
    const commessaDropdown = document.getElementById('commessaDropdown');
    const commessaClearBtn = document.getElementById('commessaClearBtn');
    const cronologiaInput  = document.getElementById('cronologiaSearchInput');
    const resultsEl        = document.getElementById('cronologiaResults');
    const userAvatarBtn    = document.getElementById('userAvatarBtn');
    const userMenu         = document.getElementById('userMenu');
    const logoutBtn        = document.getElementById('logoutBtn');
    const modalEl          = document.getElementById('cronologiaModal');
    const modalBackdrop    = document.getElementById('cronologiaModalBackdrop');
    const modalCloseBtn    = document.getElementById('cronologiaModalClose');
    const modalMeta        = document.getElementById('cronologiaModalMeta');
    const modalBody        = document.getElementById('cronologiaModalBody');

    // ── Helpers ───────────────────────────────────────────────────────────────

    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
    }

    function setEmpty(msg) {
        resultsEl.innerHTML = `<p class="cronologia-empty">${msg}</p>`;
    }

    // ── User menu ─────────────────────────────────────────────────────────────

    if (userAvatarBtn && userMenu) {
        userAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.style.display = userMenu.style.display === 'none' ? '' : 'none';
        });
        document.addEventListener('click', () => { userMenu.style.display = 'none'; });
        userMenu.addEventListener('click', (e) => e.stopPropagation());
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/logout/', {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
            });
            window.location.href = '/login/';
        });
    }

    // ── Commessa selector ─────────────────────────────────────────────────────

    commessaInput.addEventListener('input', () => {
        const q = commessaInput.value.trim();
        clearTimeout(searchTimeout);
        if (!q) {
            hideDropdown();
            return;
        }
        searchTimeout = setTimeout(() => fetchCommesse(q), 280);
    });

    commessaInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideDropdown();
            commessaInput.blur();
        }
    });

    commessaClearBtn.addEventListener('click', () => {
        clearSelection();
        commessaInput.focus();
    });

    document.addEventListener('click', (e) => {
        if (!document.getElementById('commessaWrap').contains(e.target)) {
            hideDropdown();
        }
    });

    async function fetchCommesse(q) {
        try {
            const res = await fetch(`/api/search-commesse/?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            renderDropdown(data.results || []);
        } catch {
            hideDropdown();
        }
    }

    function renderDropdown(results) {
        if (!results.length) {
            commessaDropdown.innerHTML =
                '<p style="padding:10px 12px;font-size:13px;color:var(--text-light);margin:0;">Nessun risultato</p>';
            commessaDropdown.style.display = '';
            return;
        }
        commessaDropdown.innerHTML = results.map((r) => `
            <div class="cronologia-commessa-option" data-code="${r.code}">
                <span class="cronologia-commessa-option-code">${r.code}</span>
                <span class="cronologia-commessa-option-meta">${r.customer || r.company || ''}</span>
            </div>
        `).join('');
        commessaDropdown.querySelectorAll('.cronologia-commessa-option').forEach((el) => {
            el.addEventListener('click', () => selectCommessa(el.dataset.code));
        });
        commessaDropdown.style.display = '';
    }

    function selectCommessa(code) {
        selectedCommessa = code;
        commessaInput.value = code;
        commessaBar.classList.add('has-selection');
        commessaClearBtn.style.display = '';
        hideDropdown();
        loadCronologia();
    }

    function clearSelection() {
        selectedCommessa = null;
        allItems = [];
        commessaInput.value = '';
        commessaBar.classList.remove('has-selection');
        commessaClearBtn.style.display = 'none';
        setEmpty('Seleziona una commessa per visualizzare la cronologia.');
    }

    function hideDropdown() {
        commessaDropdown.style.display = 'none';
        commessaDropdown.innerHTML = '';
    }

    // ── Cronologia search (client-side filter) ────────────────────────────────

    cronologiaInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (selectedCommessa) renderItems();
        }, 150);
    });

    // ── Load & render cronologia ──────────────────────────────────────────────

    async function loadCronologia() {
        if (!selectedCommessa) return;
        setEmpty('Caricamento…');
        try {
            const res = await fetch(`/api/cronologia/${encodeURIComponent(selectedCommessa)}/`);
            const data = await res.json();
            if (!res.ok) {
                setEmpty(`Errore: ${data.error || 'impossibile caricare la cronologia'}.`);
                return;
            }
            allItems = Array.isArray(data.items) ? data.items : [];
            renderItems();
        } catch (err) {
            setEmpty(`Errore di rete: ${err.message || err}.`);
        }
    }

    let filteredItems = [];

    function renderItems() {
        const q = cronologiaInput.value.trim().toLowerCase();
        filteredItems = q
            ? allItems.filter((it) =>
                (it.query || '').toLowerCase().includes(q) ||
                (it.response || '').toLowerCase().includes(q)
              )
            : allItems;

        if (!filteredItems.length) {
            setEmpty(
                q
                    ? `Nessuna voce corrisponde a "${escapeHtml(q)}".`
                    : `Nessuna conversazione trovata per la commessa <strong>${escapeHtml(selectedCommessa)}</strong>.`
            );
            return;
        }

        resultsEl.innerHTML = filteredItems.map((it, idx) => renderCard(it, idx)).join('');

        resultsEl.querySelectorAll('.cronologia-card-expand').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.expand, 10);
                openModal(filteredItems[idx]);
            });
        });
    }

    // ── Modal ─────────────────────────────────────────────────────────────────

    function openModal(item) {
        if (!item) return;
        const notebook = escapeHtml(item.notebook || '—');
        const user = escapeHtml(item.user || '—');
        const initial = (item.user || '?').charAt(0).toUpperCase();

        modalMeta.innerHTML = `
            <span class="cronologia-card-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                ${notebook}
            </span>
            <span class="cronologia-card-user">
                <span class="cronologia-card-avatar">${escapeHtml(initial)}</span>
                ${user}
            </span>
        `;

        modalBody.innerHTML = `
            <section>
                <span class="cronologia-modal-section-label">Domanda</span>
                <p class="cronologia-modal-question">${escapeHtml(item.query || '')}</p>
            </section>
            <section class="cronologia-modal-answer">
                <span class="cronologia-modal-section-label">Risposta</span>
                <div class="cronologia-card-markdown">${renderMarkdown(item.response || '')}</div>
            </section>
        `;

        modalEl.style.display = '';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modalEl.style.display = 'none';
        document.body.style.overflow = '';
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalEl.style.display !== 'none') closeModal();
    });

    function renderCard(item, index) {
        const notebook = escapeHtml(item.notebook || '—');
        const user = escapeHtml(item.user || '—');
        const query = escapeHtml(item.query || '');
        const responseHtml = renderMarkdown(item.response || '');
        const initial = (item.user || '?').charAt(0).toUpperCase();
        return `
            <article class="cronologia-card" data-index="${index}">
                <header class="cronologia-card-head">
                    <span class="cronologia-card-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        ${notebook}
                    </span>
                    <span class="cronologia-card-user">
                        <span class="cronologia-card-avatar">${escapeHtml(initial)}</span>
                        ${user}
                    </span>
                </header>
                <div class="cronologia-card-body">
                    <div class="cronologia-card-q">
                        <span class="cronologia-card-label">Domanda</span>
                        <p>${query}</p>
                    </div>
                    <div class="cronologia-card-a">
                        <span class="cronologia-card-label">Risposta</span>
                        <div class="cronologia-card-response-wrap">
                            <div class="cronologia-card-markdown">${responseHtml}</div>
                        </div>
                        <button class="cronologia-card-expand" data-expand="${index}">
                            Estendi
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ── Minimal Markdown renderer ─────────────────────────────────────────────
    // Supports: headings, bold, italic, inline code, fenced code, links, lists,
    // blockquotes, paragraphs.
    function renderMarkdown(md) {
        if (!md) return '';
        md = String(md).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

        const codeBlocks = [];
        md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
            codeBlocks.push(code);
            return `\n@@CB${codeBlocks.length - 1}@@\n`;
        });

        const inlineCodes = [];
        md = md.replace(/`([^`]+)`/g, (_, c) => {
            inlineCodes.push(c);
            return `@@IC${inlineCodes.length - 1}@@`;
        });

        md = escapeHtml(md);

        const lines = md.split('\n');
        let html = '';
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            if (line.trim() === '') { i++; continue; }

            const heading = line.match(/^(#{1,6})\s+(.+)$/);
            if (heading) {
                const lvl = heading[1].length;
                html += `<h${lvl}>${heading[2]}</h${lvl}>`;
                i++; continue;
            }

            const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
            if (olMatch) {
                const items = [];
                while (i < lines.length) {
                    const m = lines[i].match(/^\s*\d+\.\s+(.+)$/);
                    if (!m) break;
                    items.push(m[1]);
                    i++;
                }
                html += `<ol>${items.map((it) => `<li>${it}</li>`).join('')}</ol>`;
                continue;
            }

            const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
            if (ulMatch) {
                const items = [];
                while (i < lines.length) {
                    const m = lines[i].match(/^\s*[-*+]\s+(.+)$/);
                    if (!m) break;
                    items.push(m[1]);
                    i++;
                }
                html += `<ul>${items.map((it) => `<li>${it}</li>`).join('')}</ul>`;
                continue;
            }

            if (/^&gt;\s*/.test(line)) {
                const quote = [];
                while (i < lines.length && /^&gt;\s*/.test(lines[i])) {
                    quote.push(lines[i].replace(/^&gt;\s*/, ''));
                    i++;
                }
                html += `<blockquote>${quote.join(' ')}</blockquote>`;
                continue;
            }

            const para = [];
            while (
                i < lines.length &&
                lines[i].trim() !== '' &&
                !/^#{1,6}\s/.test(lines[i]) &&
                !/^\s*(\d+\.|[-*+])\s/.test(lines[i]) &&
                !/^&gt;\s*/.test(lines[i]) &&
                !/@@CB\d+@@/.test(lines[i])
            ) {
                para.push(lines[i]);
                i++;
            }
            if (para.length) html += `<p>${para.join(' ')}</p>`;
        }

        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
        html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) =>
            `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);

        html = html.replace(/@@IC(\d+)@@/g, (_, idx) => `<code>${escapeHtml(inlineCodes[+idx])}</code>`);
        html = html.replace(/@@CB(\d+)@@/g, (_, idx) => `<pre><code>${escapeHtml(codeBlocks[+idx])}</code></pre>`);

        return html;
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    commessaInput.focus();

})();
