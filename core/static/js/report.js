/**
 * Report page — compact top generation bar + cronologia-style cards.
 */
(function () {
    let currentCommessa = null;
    let currentCollection = null;
    let currentReports = [];
    let currentOpenReport = null;
    let currentEditItem = null;
    let currentEditArticle = null;

    const $ = (id) => document.getElementById(id);

    function showEmpty() {
        $('reportEmpty').style.display = '';
        $('reportLoading').style.display = 'none';
        $('reportFormSection').style.display = 'none';
        $('reportList').style.display = 'none';
    }

    function showLoadingState() {
        $('reportEmpty').style.display = 'none';
        $('reportLoading').style.display = '';
        $('reportFormSection').style.display = 'none';
        $('reportList').style.display = 'none';
    }

    function showReady() {
        $('reportEmpty').style.display = 'none';
        $('reportLoading').style.display = 'none';
        $('reportFormSection').style.display = '';
        $('reportList').style.display = '';
    }

    function escapeHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function getCookie(name) {
        const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : '';
    }

    // ── Minimal markdown renderer (mirrors cronologia.js) ────────────────────
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
                html += `<h${heading[1].length}>${heading[2]}</h${heading[1].length}>`;
                i++; continue;
            }
            const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
            if (olMatch) {
                const items = [];
                while (i < lines.length) {
                    const m = lines[i].match(/^\s*\d+\.\s+(.+)$/);
                    if (!m) break;
                    items.push(m[1]); i++;
                }
                html += `<ol>${items.map(it => `<li>${it}</li>`).join('')}</ol>`;
                continue;
            }
            const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
            if (ulMatch) {
                const items = [];
                while (i < lines.length) {
                    const m = lines[i].match(/^\s*[-*+]\s+(.+)$/);
                    if (!m) break;
                    items.push(m[1]); i++;
                }
                html += `<ul>${items.map(it => `<li>${it}</li>`).join('')}</ul>`;
                continue;
            }
            if (/^&gt;\s*/.test(line)) {
                const quote = [];
                while (i < lines.length && /^&gt;\s*/.test(lines[i])) {
                    quote.push(lines[i].replace(/^&gt;\s*/, '')); i++;
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
            ) { para.push(lines[i]); i++; }
            if (para.length) html += `<p>${para.join(' ')}</p>`;
        }
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
        html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
            (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
        html = html.replace(/@@IC(\d+)@@/g, (_, idx) => `<code>${escapeHtml(inlineCodes[+idx])}</code>`);
        html = html.replace(/@@CB(\d+)@@/g, (_, idx) => `<pre><code>${escapeHtml(codeBlocks[+idx])}</code></pre>`);
        return html;
    }

    // ── Cards (wide-row, name prominent, details below, orange trash) ────────
    function formatDate(iso) {
        try {
            return new Date(iso).toLocaleString('it-IT', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch { return ''; }
    }

    function renderCards(reports) {
        const list = $('reportList');
        const empty = $('reportListEmpty');
        [...list.querySelectorAll('.report-card')].forEach(el => el.remove());

        const readyReports = (reports || []).filter(r => r.status === 'ready');
        if (readyReports.length === 0) {
            empty.style.display = '';
            return;
        }
        empty.style.display = 'none';

        const frag = document.createDocumentFragment();
        readyReports.forEach((r) => {
            const el = document.createElement('article');
            el.className = 'report-card';
            el.dataset.reportId = r.id;
            el.innerHTML = `
                <div class="report-card-main">
                    <h3 class="report-card-name" title="${escapeHtml(r.report_name)}">${escapeHtml(r.report_name)}</h3>
                    <div class="report-card-details">
                        <span><strong>${r.total_queries}</strong> domande</span>
                        <span class="report-card-sep">·</span>
                        <span>modalità <strong>${escapeHtml(r.mode)}</strong></span>
                        <span class="report-card-sep">·</span>
                        <span>${escapeHtml(formatDate(r.created_at))}</span>
                    </div>
                </div>
                <div class="report-card-menu-wrap">
                    <button class="report-qna-menu-btn" title="Opzioni" aria-label="Opzioni">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <circle cx="12" cy="5" r="1.5"></circle>
                            <circle cx="12" cy="12" r="1.5"></circle>
                            <circle cx="12" cy="19" r="1.5"></circle>
                        </svg>
                    </button>
                    <div class="report-qna-dropdown">
                        <button class="report-qna-dropdown-item" data-action="export">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Esporta Excel
                        </button>
                        <button class="report-qna-dropdown-item danger" data-action="delete">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                            Elimina
                        </button>
                    </div>
                </div>
            `;

            // Only the main text area opens the detail modal
            el.querySelector('.report-card-main').addEventListener('click', () => openDetailModal(r));

            // 3-dot button: stop propagation so card click doesn't fire
            const menuBtn = el.querySelector('.report-qna-menu-btn');
            const wrap = el.querySelector('.report-card-menu-wrap');
            const dropdown = el.querySelector('.report-qna-dropdown');

            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wasOpen = wrap.classList.contains('open');
                closeCardMenus();
                if (!wasOpen) {
                    const rect = menuBtn.getBoundingClientRect();
                    dropdown.style.top = `${rect.bottom + 4}px`;
                    dropdown.style.left = `${Math.max(8, rect.right - 160)}px`;
                    wrap.classList.add('open');
                }
            });

            // Dropdown actions
            el.querySelectorAll('.report-card-menu-wrap .report-qna-dropdown-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeCardMenus();
                    if (btn.dataset.action === 'delete') handleCardDelete(r.id);
                    else if (btn.dataset.action === 'export') exportReport(r.id);
                });
            });

            frag.appendChild(el);
        });
        list.appendChild(frag);
    }

    function initCardMenuEvents() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.report-card-menu-wrap')) closeCardMenus();
        });
    }

    function closeCardMenus() {
        document.querySelectorAll('.report-card-menu-wrap.open')
            .forEach(w => w.classList.remove('open'));
    }

    async function handleCardDelete(reportId) {
        if (!confirm('Eliminare definitivamente questo report?')) return;
        try {
            const res = await fetch(
                `/api/reports/delete/?id=${encodeURIComponent(reportId)}`,
                { method: 'DELETE', headers: { 'X-CSRFToken': getCookie('docslm_csrftoken') } }
            );
            if (!res.ok) throw new Error('delete failed');
            await refreshReports();
        } catch {
            alert('Impossibile eliminare il report.');
        }
    }

    function exportReport(reportId) {
        window.location.href = `/api/reports/export/?id=${encodeURIComponent(reportId)}`;
    }

    // ── Detail modal (compact Q/A items) ─────────────────────────────────────
    function formatReferencesHtml(refs) {
        if (!Array.isArray(refs) || refs.length === 0) return '';
        const items = refs.map(r => {
            const name = escapeHtml(r.name || 'unknown');
            let pages = '';
            if (r.page_start != null && r.page_end != null && r.page_start !== r.page_end) {
                pages = ` · pp. ${r.page_start}-${r.page_end}`;
            } else if (r.page_start != null) {
                pages = ` · p. ${r.page_start}`;
            }
            return `<span class="report-ref-tag">${name}${pages}</span>`;
        }).join('');
        return `<div class="report-refs">${items}</div>`;
    }

    function renderModalItem(it, idx) {
        return `
            <article class="report-qna-item" data-item-id="${it.id}">
                <div class="report-qna-menu-wrap">
                    <button class="report-qna-menu-btn" title="Opzioni" aria-label="Opzioni">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <circle cx="12" cy="5" r="1.5"></circle>
                            <circle cx="12" cy="12" r="1.5"></circle>
                            <circle cx="12" cy="19" r="1.5"></circle>
                        </svg>
                    </button>
                    <div class="report-qna-dropdown">
                        <button class="report-qna-dropdown-item" data-action="edit">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Modifica
                        </button>
                        <button class="report-qna-dropdown-item danger" data-action="delete">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                            Elimina
                        </button>
                    </div>
                </div>
                <div class="report-qna-header">
                    <span class="report-qna-num">${idx + 1}</span>
                    <p class="report-qna-q">${escapeHtml(it.query || '')}</p>
                </div>
                <div class="report-qna-a">${renderMarkdown(it.response || '—')}</div>
                ${formatReferencesHtml(it.references)}
            </article>
        `;
    }

    async function openDetailModal(rpt) {
        currentOpenReport = rpt;
        const modal = $('reportModal');
        const meta = $('reportModalMeta');
        const body = $('reportModalBody');

        meta.innerHTML = `
            <span class="cronologia-card-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${escapeHtml(rpt.report_name)}
            </span>
            <span class="cronologia-card-user" id="reportModalQueryCount">
                ${escapeHtml(rpt.mode)} · ${rpt.total_queries} domande · ${escapeHtml(formatDate(rpt.created_at))}
            </span>
        `;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        if (rpt.status === 'error') {
            body.innerHTML = `<p class="report-modal-status report-modal-status-error">
                Il report è terminato con errore. ${escapeHtml(rpt.error_message || '')}
            </p>`;
            return;
        }
        if (rpt.status !== 'ready') {
            body.innerHTML = `<p class="report-modal-status">
                Report in elaborazione: ${rpt.done_queries}/${rpt.total_queries} domande completate.
            </p>`;
            return;
        }

        // Lazy-load items if not already cached
        if (!rpt.items) {
            body.innerHTML = `<p class="report-modal-status">Caricamento…</p>`;
            try {
                const res = await fetch(`/api/reports/status/?id=${encodeURIComponent(rpt.id)}&items=1`);
                const data = await res.json();
                rpt.items = data.items || [];
                // Update cached reference in currentReports
                const idx = currentReports.findIndex(r => r.id === rpt.id);
                if (idx !== -1) currentReports[idx].items = rpt.items;
            } catch {
                body.innerHTML = `<p class="report-modal-status report-modal-status-error">Errore nel caricamento degli item.</p>`;
                return;
            }
        }

        body.innerHTML = (rpt.items || []).map(renderModalItem).join('');
        initModalBodyEvents(body);
    }

    function closeDetailModal() {
        $('reportModal').style.display = 'none';
        document.body.style.overflow = '';
        currentOpenReport = null;
        closeAllMenus();
    }

    // ── Item menu / dropdown ──────────────────────────────────────────────────
    function closeAllMenus() {
        document.querySelectorAll('.report-qna-menu-wrap.open')
            .forEach(w => w.classList.remove('open'));
    }

    function initModalBodyEvents(body) {
        body.addEventListener('click', (e) => {
            const menuBtn = e.target.closest('.report-qna-menu-btn');
            if (menuBtn) {
                e.stopPropagation();
                const wrap = menuBtn.closest('.report-qna-menu-wrap');
                const wasOpen = wrap.classList.contains('open');
                closeAllMenus();
                if (!wasOpen) {
                    const dropdown = wrap.querySelector('.report-qna-dropdown');
                    const rect = menuBtn.getBoundingClientRect();
                    dropdown.style.top = `${rect.bottom + 4}px`;
                    // right-align dropdown with the button
                    const dropW = 140;
                    dropdown.style.left = `${Math.max(8, rect.right - dropW)}px`;
                    wrap.classList.add('open');
                }
                return;
            }

            const actionBtn = e.target.closest('.report-qna-dropdown-item');
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                const article = actionBtn.closest('.report-qna-item');
                const itemId = article?.dataset.itemId;
                closeAllMenus();
                if (action === 'delete') {
                    handleDeleteItem(itemId, article);
                } else if (action === 'edit') {
                    const item = (currentOpenReport?.items || [])
                        .find(it => String(it.id) === String(itemId));
                    if (item) openItemEditModal(item, article);
                }
                return;
            }

            if (!e.target.closest('.report-qna-menu-wrap')) {
                closeAllMenus();
            }
        });
    }

    // ── Delete item ───────────────────────────────────────────────────────────
    async function handleDeleteItem(itemId, articleEl) {
        if (!confirm('Eliminare questa domanda dal report?')) return;
        try {
            const res = await fetch(
                `/api/reports/item/delete/?id=${encodeURIComponent(itemId)}`,
                { method: 'DELETE', headers: { 'X-CSRFToken': getCookie('docslm_csrftoken') } }
            );
            if (!res.ok) throw new Error('delete failed');

            if (currentOpenReport?.items) {
                currentOpenReport.items = currentOpenReport.items
                    .filter(it => String(it.id) !== String(itemId));
                currentOpenReport.total_queries = currentOpenReport.items.length;
            }
            articleEl?.remove();

            const countEl = $('reportModalQueryCount');
            if (countEl && currentOpenReport) {
                countEl.textContent = `${currentOpenReport.mode} · ${currentOpenReport.total_queries} domande · ${formatDate(currentOpenReport.created_at)}`;
            }
        } catch {
            alert('Impossibile eliminare la domanda.');
        }
    }

    // ── Edit item modal ───────────────────────────────────────────────────────
    function openItemEditModal(item, articleEl) {
        currentEditItem = item;
        currentEditArticle = articleEl;
        $('reportItemEditQuery').value = item.query || '';
        $('reportItemEditResponse').value = item.response || '';
        $('reportItemEditModal').style.display = 'flex';
    }

    function closeItemEditModal() {
        $('reportItemEditModal').style.display = 'none';
        currentEditItem = null;
        currentEditArticle = null;
    }

    async function saveItemEdit() {
        if (!currentEditItem) return;
        const query = $('reportItemEditQuery').value.trim();
        const response = $('reportItemEditResponse').value.trim();

        const saveBtn = $('reportItemEditSave');
        saveBtn.disabled = true;

        try {
            const res = await fetch('/api/reports/item/update/', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('docslm_csrftoken'),
                },
                body: JSON.stringify({ id: currentEditItem.id, query, response }),
            });
            if (!res.ok) throw new Error('update failed');

            currentEditItem.query = query;
            currentEditItem.response = response;

            if (currentEditArticle) {
                const qEl = currentEditArticle.querySelector('.report-qna-q');
                const aEl = currentEditArticle.querySelector('.report-qna-a');
                if (qEl) qEl.textContent = query;
                if (aEl) aEl.innerHTML = renderMarkdown(response || '—');
            }
            closeItemEditModal();
        } catch {
            alert('Impossibile salvare le modifiche.');
        } finally {
            saveBtn.disabled = false;
        }
    }

    // ── List / polling ────────────────────────────────────────────────────────
    async function refreshReports() {
        if (!currentCommessa || !currentCollection) return;
        try {
            const res = await fetch(
                `/api/reports/list/?commessa=${encodeURIComponent(currentCommessa)}&collection=${encodeURIComponent(currentCollection)}`
            );
            if (!res.ok) throw new Error('list failed');
            const data = await res.json();
            currentReports = data.reports || [];
            renderCards(currentReports);
        } catch (err) {
            console.warn('refreshReports error', err);
        }
    }

    // ── Submit ────────────────────────────────────────────────────────────────
    function updateSubmitState() {
        const btn = $('reportSubmitBtn');
        const name = $('reportNameInput').value.trim();
        const hasFile = !!$('reportFileInput').files[0];
        const ready = !!(currentCommessa && currentCollection && name && hasFile);
        btn.disabled = !ready;
        btn.classList.toggle('disabled', !ready);
    }

    async function submitReport(e) {
        e.preventDefault();
        const errEl = $('reportFormError');
        errEl.style.display = 'none';

        if (!currentCommessa || !currentCollection) return;
        const name = $('reportNameInput').value.trim();
        const mode = $('reportModeSelect').value;
        const fileInput = $('reportFileInput');
        if (!name || !fileInput.files[0]) return;

        const fd = new FormData();
        fd.append('commessa', currentCommessa);
        fd.append('collection', currentCollection);
        fd.append('report_name', name);
        fd.append('mode', mode);
        fd.append('file', fileInput.files[0]);

        const btn = $('reportSubmitBtn');
        btn.disabled = true;
        btn.classList.add('disabled');

        try {
            const res = await fetch('/api/reports/create/', {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('docslm_csrftoken') },
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) {
                errEl.textContent = data.error || 'Errore durante la creazione del report.';
                errEl.style.display = '';
                return;
            }
            $('reportForm').reset();
            $('reportFileLabelText').textContent = 'Allega file .xlsx';
            $('reportFileLabel').classList.remove('has-file');
            if (typeof addReportTask === 'function' && data.report) {
                addReportTask({
                    id: data.report.id,
                    commessa: data.report.commessa,
                    collection_name: data.report.collection_name,
                    report_name: data.report.report_name,
                    status: data.report.status || 'pending',
                    done_queries: data.report.done_queries || 0,
                    total_queries: data.report.total_queries || 0,
                });
            }
            await refreshReports();
        } catch (err) {
            errEl.textContent = String(err);
            errEl.style.display = '';
        } finally {
            updateSubmitState();
        }
    }

    // ── Mode dropdown ─────────────────────────────────────────────────────────
    function initModeDropdown() {
        const btn = $('reportModeDropdown');
        const menu = $('reportModeMenu');
        const hidden = $('reportModeSelect');
        const label = $('reportModeLabel');
        if (!btn || !menu) return;

        const syncCheck = () => {
            menu.querySelectorAll('.model-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.value === hidden.value);
            });
        };
        syncCheck();

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('open');
            menu.classList.toggle('open', !isOpen);
            btn.classList.toggle('open', !isOpen);
            btn.classList.toggle('active', !isOpen);
        });

        menu.querySelectorAll('.model-option').forEach(opt => {
            opt.addEventListener('click', () => {
                hidden.value = opt.dataset.value;
                label.textContent = opt.querySelector('.model-option-title').textContent;
                menu.classList.remove('open');
                btn.classList.remove('open');
                btn.classList.remove('active');
                syncCheck();
            });
        });

        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.remove('open');
                btn.classList.remove('open');
                btn.classList.remove('active');
            }
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        showEmpty();

        $('reportForm').addEventListener('submit', submitReport);
        $('reportModalClose').addEventListener('click', closeDetailModal);
        $('reportModalBackdrop').addEventListener('click', closeDetailModal);
        $('reportItemEditClose').addEventListener('click', closeItemEditModal);
        $('reportItemEditCancel').addEventListener('click', closeItemEditModal);
        $('reportItemEditSave').addEventListener('click', saveItemEdit);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if ($('reportItemEditModal').style.display !== 'none') {
                    closeItemEditModal();
                } else {
                    closeDetailModal();
                }
            }
        });

        initModeDropdown();
        initCardMenuEvents();

        $('reportNameInput').addEventListener('input', updateSubmitState);

        $('reportFileInput').addEventListener('change', (e) => {
            const f = e.target.files[0];
            const txt = $('reportFileLabelText');
            const lbl = $('reportFileLabel');
            if (f) {
                txt.textContent = f.name;
                lbl.classList.add('has-file');
            } else {
                txt.textContent = 'Allega file .xlsx';
                lbl.classList.remove('has-file');
            }
            updateSubmitState();
        });

        document.addEventListener('collectionLoading', () => {
            showLoadingState();
        });

        document.addEventListener('collectionSelected', async (e) => {
            const { commessa, collection } = e.detail || {};
            if (!commessa || !collection) return;
            currentCommessa = commessa;
            currentCollection = collection;
            showReady();
            updateSubmitState();
            await refreshReports();
        });

        window.addEventListener('report-tasks-complete', () => {
            refreshReports();
        });
    });
})();
