/**
 * Report Module - Handles report generation and download
 */

import { getCookie } from './core/utils.js';
import { ensureChatVisible } from './core/chat.js';
import { appendLoader } from './core/chat.js';
import { showAgentInactive, getActiveCollection } from './core/agent.js';

/**
 * Generate summary from uploaded file
 */
export async function generateSummary() {
    const activeCollection = getActiveCollection();
    if (!activeCollection) {
        showAgentInactive();
        return;
    }
    
    // Mostra la modal di upload
    const reportModal = document.getElementById('reportUploadModal');
    if (reportModal) {
        reportModal.classList.add('open');
    }
}

/**
 * Handle report file upload
 * @param {Event} event - File input change event
 */
export async function handleReportFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reportModal = document.getElementById('reportUploadModal');
    if (reportModal) {
        reportModal.classList.remove('open');
    }

    const summaryBtn = document.getElementById('summaryBtn');
    if (summaryBtn) {
        summaryBtn.disabled = true;
    }

    ensureChatVisible();
    const loaderRow = appendLoader();

    try {
        const activeCollection = getActiveCollection();
        if (!activeCollection) {
            throw new Error('No collection selected');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('commessa', activeCollection.commessa);
        formData.append('collection', activeCollection.collection);

        const response = await fetch('/api/generate-report/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: formData
        });

        if (loaderRow) {
            if (loaderRow._timer) clearInterval(loaderRow._timer);
            loaderRow.remove();
        }

        const data = await response.json();
        
        if (response.ok) {
            // Create banner with download button
            const bannerHTML = `
                <div style="background: white; border-radius: 16px; padding: 24px; margin: 12px 0; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); border: 1px solid #f0f0f0; backdrop-filter: blur(10px); background: rgba(255, 255, 255, 0.95);">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px;">
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; line-height: 1.4;">${data.filename || 'report.xlsx'}</div>
                            <div style="font-size: 13px; color: #666; margin-bottom: 14px;">Report generato con successo</div>
                        </div>
                        <button onclick="downloadReportFile('${data.token}', '${data.filename}')" style="padding: 12px 24px; background: var(--accent-color); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; box-shadow: 0 4px 12px rgba(212, 112, 77, 0.2);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download
                        </button>
                    </div>
                </div>
            `;
            
            const chatHistory = document.getElementById('chatHistory');
            if (chatHistory) {
                const row = document.createElement('div');
                row.className = 'chat-row assistant';
                row.innerHTML = bannerHTML;
                chatHistory.appendChild(row);
                
                setTimeout(() => {
                    const rect = row.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const targetScroll = scrollTop + rect.top - 40;
                    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
                }, 100);
            }
        } else {
            console.error('Error generating report:', data.error);
            alert(`Errore: ${data.error || 'Impossibile generare il report'}`);
        }
    } catch (error) {
        if (loaderRow) {
            if (loaderRow._timer) clearInterval(loaderRow._timer);
            loaderRow.remove();
        }
        console.error('Error generating report:', error);
        alert('Errore durante la generazione del report');
    } finally {
        if (summaryBtn) {
            summaryBtn.disabled = false;
        }
    }
}

/**
 * Download report file
 * @param {string} token - Download token
 * @param {string} filename - File name
 */
export function downloadReportFile(token, filename) {
    const url = `/api/download-report/?token=${encodeURIComponent(token)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Make downloadReportFile globally available for inline onclick
window.downloadReportFile = downloadReportFile;

/**
 * Setup report-related event listeners
 */
export function setupReportListeners() {
    const summaryBtn = document.getElementById('summaryBtn');
    const reportUploadModal = document.getElementById('reportUploadModal');
    const reportUploadClose = document.getElementById('reportUploadClose');
    const reportUploadBtn = document.getElementById('reportUploadBtn');
    
    if (summaryBtn) {
        summaryBtn.addEventListener('click', generateSummary);
    }

    if (reportUploadClose) {
        reportUploadClose.addEventListener('click', () => {
            if (reportUploadModal) {
                reportUploadModal.classList.remove('open');
            }
        });
    }

    if (reportUploadBtn) {
        reportUploadBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.xlsx,.xls';
            
            fileInput.addEventListener('change', (e) => {
                handleReportFileUpload(e);
            });
            fileInput.click();
        });
    }
}
