/**
 * Source Modal - Display file source preview in modal
 */

import { getCookie } from '../core/utils.js';

/**
 * Open source modal with file preview
 * @param {Object} btnDef - Button definition with metadata
 */
export function openSourceModal(btnDef) {
    // create overlay
    const overlay = document.createElement('div');
    overlay.className = 'source-modal-overlay';

    // modal container
    const modal = document.createElement('div');
    modal.className = 'source-modal';

    // close button (top-right)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'source-modal-close';
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';

    // content area (below header) populated with metadata
    const content = document.createElement('div');
    content.className = 'source-modal-content';

    // Header panel with formatted title
    const header = document.createElement('div');
    header.className = 'source-modal-header';

    const meta = btnDef.metadata || {};
    const rawName = btnDef.name || meta.name || 'Fonte';
    const rawType = (btnDef.type || meta.type || '').toString().toLowerCase();
    const ps = (btnDef.page_start !== undefined && btnDef.page_start !== null) ? btnDef.page_start : meta.page_start;
    const pe = (btnDef.page_end !== undefined && btnDef.page_end !== null) ? btnDef.page_end : meta.page_end;

    let headerTitle = rawName;
    if (rawType === 'text') {
        if (ps !== undefined && ps !== null) {
            const s = String(ps);
            const e = (pe !== undefined && pe !== null) ? String(pe) : null;
            if (e && e === s) {
                headerTitle += ` (pag. ${s})`;
            } else if (e) {
                headerTitle += ` (pag. ${s}-${e})`;
            } else {
                headerTitle += ` (pag. ${s})`;
            }
        }
    } else if (rawType === 'draw' || rawType === 'image') {
        // just the name (already set)
    }

    header.textContent = headerTitle;

    // attach header at top of modal
    modal.appendChild(header);

    // Only show the formatted title and the visual preview below
    const info = document.createElement('div');
    info.className = 'source-modal-info';

    const loading = document.createElement('div');
    loading.className = 'source-modal-loading';
    loading.textContent = 'Caricamento anteprima...';
    info.appendChild(loading);
    content.appendChild(info);

    const pathVal = (meta && (meta.path || meta.source)) || btnDef.name || '';
    if (!pathVal) {
        loading.textContent = 'Anteprima non disponibile.';
    } else {
        fetch('/api/check-path/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ 
                path: pathVal, 
                type: rawType,  // Add the type to the request
                page_start: ps !== undefined ? ps : null, 
                page_end: pe !== undefined ? pe : null 
            })
        }).then(r => r.json()).then(res => {
            loading.remove();
            if (res && (res.preview !== undefined || res.pdf_data_uri || res.data_uri || res.listing)) {
                // If server returned a text preview, show it
                if (res.preview !== undefined && res.preview !== null) {
                    const pre = document.createElement('pre');
                    pre.className = 'source-preview';
                    pre.style.whiteSpace = 'pre-wrap';
                    pre.style.maxHeight = '60vh';
                    pre.style.overflow = 'auto';
                    pre.textContent = res.preview;
                    content.appendChild(pre);
                }

                // If server returned a PDF data URI, embed it visually
                else if (res.pdf_data_uri) {
                    const iframe = document.createElement('iframe');
                    iframe.src = res.pdf_data_uri;
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.title = 'Anteprima PDF';
                    content.appendChild(iframe);
                }

                // If server returned an image data URI, show it
                else if (res.data_uri) {
                    const img = document.createElement('img');
                    img.src = res.data_uri;
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '60vh';
                    img.alt = 'Anteprima immagine';
                    content.appendChild(img);
                }

                // If directory listing
                else if (res.listing && Array.isArray(res.listing)) {
                    const ul = document.createElement('ul');
                    res.listing.forEach((it) => {
                        const li = document.createElement('li');
                        li.textContent = it.name + (it.is_dir ? ' (cartella)' : '');
                        ul.appendChild(li);
                    });
                    content.appendChild(ul);
                }

                else if (res.error) {
                    const e = document.createElement('p');
                    e.textContent = 'Errore: ' + res.error;
                    content.appendChild(e);
                }

            } else if (res && res.error) {
                const e = document.createElement('p');
                e.textContent = 'Errore: ' + res.error;
                content.appendChild(e);
            } else {
                const e = document.createElement('p');
                e.textContent = 'Anteprima non disponibile.';
                content.appendChild(e);
            }
        }).catch(() => {
            loading.textContent = 'Errore durante il caricamento dell\'anteprima.';
        });
    }

    modal.appendChild(closeBtn);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // handlers
    function closeModal() {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
        if (e.key === 'Escape') closeModal();
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', onKey);
}
