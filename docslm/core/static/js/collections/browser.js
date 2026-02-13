/**
 * File Browser Module - Handles job file browsing
 */

import { modalSelectedFiles, updateModalSelectedFiles } from './files.js';

/**
 * Load job files
 * @param {string} commessa - Commessa code
 * @param {string} subpath - Subpath within commessa
 */
export async function loadJobFiles(commessa, subpath = '') {
    const body = document.querySelector('.create-collection-body');
    if (!body) return;
    body.innerHTML = `<div style="padding:12px;color:var(--text-light)">Caricamento file...</div>`;
    try {
        const url = `/api/list-job-files/?commessa=${encodeURIComponent(commessa)}&subpath=${encodeURIComponent(subpath)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.error) {
            body.innerHTML = `<div style="padding:12px;color:red">Errore: ${data.error}</div>`;
            return;
        }
        renderJobFileBrowser(data);
    } catch (err) {
        console.error('loadJobFiles error', err);
        body.innerHTML = `<div style="padding:12px;color:red">Errore di connessione</div>`;
    }
}

/**
 * Render job file browser
 * @param {Object} data - File browser data
 */
export function renderJobFileBrowser(data) {
    const body = document.querySelector('.create-collection-body');
    if (!body) return;
    body.innerHTML = '';

    const subpath = data.subpath || '';

    // Breadcrumbs
    const bc = document.createElement('div');
    bc.className = 'jobfiles-breadcrumbs';
    bc.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:16px;padding:8px 12px;background:var(--secondary-color);border-radius:6px;font-size:13px;font-weight:500;color:var(--text-color);border:1px solid var(--border-color);flex-wrap:wrap;';

    const rootLink = document.createElement('a');
    rootLink.href = '#';
    rootLink.textContent = data.commessa;
    rootLink.style.cssText = 'color:var(--accent-color);text-decoration:none;transition:opacity 0.2s;';
    rootLink.addEventListener('click', (e) => { e.preventDefault(); loadJobFiles(data.commessa, ''); });
    rootLink.addEventListener('mouseenter', (e) => e.target.style.opacity = '0.7');
    rootLink.addEventListener('mouseleave', (e) => e.target.style.opacity = '1');
    bc.appendChild(rootLink);

    if (subpath) {
        const parts = subpath.split('/').filter(Boolean);
        let accum = '';
        parts.forEach((p) => {
            accum = accum ? (accum + '/' + p) : p;
            const sep = document.createElement('span');
            sep.textContent = '/';
            sep.style.cssText = 'color:var(--text-light);margin:0 2px;';
            bc.appendChild(sep);
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = p;
            link.style.cssText = 'color:var(--accent-color);text-decoration:none;transition:opacity 0.2s;';
            link.addEventListener('click', (e) => { e.preventDefault(); loadJobFiles(data.commessa, accum); });
            link.addEventListener('mouseenter', (e) => e.target.style.opacity = '0.7');
            link.addEventListener('mouseleave', (e) => e.target.style.opacity = '1');
            bc.appendChild(link);
        });
    }

    body.appendChild(bc);

    if (!data.entries || data.entries.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:40px 12px;color:var(--text-light);font-size:14px;';
        empty.textContent = 'Nessun file o cartella in questa posizione.';
        body.appendChild(empty);
        return;
    }

    const listWrap = document.createElement('div');
    listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    // Folders first
    data.entries.filter(e => e.is_dir).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'jobfile-row jobfile-folder';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--secondary-color);cursor:pointer;transition:all 0.2s;';
        
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--button-bg)';
            row.style.borderColor = 'var(--accent-color)';
            row.style.transform = 'translateX(2px)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'var(--secondary-color)';
            row.style.borderColor = 'var(--border-color)';
            row.style.transform = 'translateX(0)';
        });

        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:10px;';
        left.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span style="font-size:14px;font-weight:500;color:var(--text-color);">${entry.name}</span>`;
        row.appendChild(left);

        const arrow = document.createElement('div');
        arrow.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>';
        arrow.style.cssText = 'display:flex;align-items:center;transition:transform 0.2s;';
        row.appendChild(arrow);

        row.addEventListener('click', () => {
            const newSub = subpath ? (subpath + '/' + entry.name) : entry.name;
            loadJobFiles(data.commessa, newSub);
        });
        
        listWrap.appendChild(row);
    });

    // Files
    data.entries.filter(e => !e.is_dir).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'jobfile-row jobfile-file';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--secondary-color);transition:all 0.2s;';
        
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--button-bg)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'var(--secondary-color)';
        });

        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;';
        left.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span style="font-size:14px;color:var(--text-color);">${entry.name}</span>`;
        row.appendChild(left);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:var(--accent-color);';
        const relPath = subpath ? (subpath + '/' + entry.name) : entry.name;
        checkbox.dataset.path = relPath;
        checkbox.addEventListener('change', (e) => {
            const p = e.target.dataset.path;
            if (e.target.checked) {
                updateModalSelectedFiles('add', p);
            } else {
                updateModalSelectedFiles('remove', p);
            }
        });
        checkbox.addEventListener('click', (e) => e.stopPropagation());

        row.appendChild(checkbox);
        listWrap.appendChild(row);
    });

    body.appendChild(listWrap);
}
