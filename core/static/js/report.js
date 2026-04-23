/**
 * Report page — compact top generation bar + cronologia-style cards.
 */
(function () {
    let currentCommessa = null;
    let currentCollection = null;
    let currentReports = [];

    const $ = (id) => document.getElementById(id);

    function showEmpty() {
        $('reportEmpty').style.display = '';
        $('reportFormSection').style.display = 'none';
        $('reportList').style.display = 'none';
    }

    function showReady() {
        $('reportEmpty').style.display = 'none';
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
                <button class="report-card-delete" data-id="${r.id}" title="Elimina report" aria-label="Elimina report">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
            el.addEventListener('click', (e) => {
                if (e.target.closest('.report-card-delete')) return;
                openDetailModal(r);
            });
            frag.appendChild(el);
        });
        list.appendChild(frag);

        list.querySelectorAll('.report-card-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Eliminare definitivamente questo report?')) return;
                try {
                    const res = await fetch(
                        `/api/reports/delete/?id=${encodeURIComponent(btn.dataset.id)}`,
                        { method: 'DELETE', headers: { 'X-CSRFToken': getCookie('csrftoken') } }
                    );
                    if (!res.ok) throw new Error('delete failed');
                    await refreshReports();
                } catch {
                    alert('Impossibile eliminare il report.');
                }
            });
        });
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
            <article class="report-qna-item">
                <div class="report-qna-header">
                    <span class="report-qna-num">${idx + 1}</span>
                    <p class="report-qna-q">${escapeHtml(it.query || '')}</p>
                </div>
                <div class="report-qna-a">${renderMarkdown(it.response || '—')}</div>
                ${formatReferencesHtml(it.references)}
            </article>
        `;
    }

    function openDetailModal(rpt) {
        const modal = $('reportModal');
        const meta = $('reportModalMeta');
        const body = $('reportModalBody');

        meta.innerHTML = `
            <span class="cronologia-card-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${escapeHtml(rpt.report_name)}
            </span>
            <span class="cronologia-card-user">
                ${escapeHtml(rpt.mode)} · ${rpt.total_queries} domande · ${escapeHtml(formatDate(rpt.created_at))}
            </span>
        `;

        if (rpt.status === 'error') {
            body.innerHTML = `<p class="report-modal-status report-modal-status-error">
                Il report è terminato con errore. ${escapeHtml(rpt.error_message || '')}
            </p>`;
        } else if (rpt.status !== 'ready') {
            body.innerHTML = `<p class="report-modal-status">
                Report in elaborazione: ${rpt.done_queries}/${rpt.total_queries} domande completate.
            </p>`;
        } else {
            body.innerHTML = (rpt.items || []).map(renderModalItem).join('');
        }
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeDetailModal() {
        $('reportModal').style.display = 'none';
        document.body.style.overflow = '';
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
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
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
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeDetailModal();
        });

        initModeDropdown();

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
