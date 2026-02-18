/**
 * Job Modal - Display job details in modal
 */

/**
 * Show job details modal
 * @param {Object} job - Job object
 */
export function showJobDetails(job) {
    const modal = document.getElementById('jobModal');
    const title = document.getElementById('modalJobTitle');
    const details = document.getElementById('modalDetails');
    if (!modal || !title || !details) return;
    title.textContent = `Commessa ${job.code}`;
    const fields = [
        { label: 'Cliente', value: job.customer },
        { label: 'Società', value: job.company },
        { label: 'Tipo', value: job.typeof },
        { label: 'PM', value: job.project_manager },
        { label: 'Stato', value: job.status },
        { label: 'Consegna', value: job.end_date },
        { label: 'Stabilimento', value: job.site },
        { label: 'Resa', value: job.output },
        { label: 'Scopo', value: job.goal, fullWidth: true }
    ];
    details.innerHTML = fields.map(f => `
        <div class="detail-item" style="${f.fullWidth ? 'grid-column: 1 / -1' : ''}">
            <span class="detail-label">${f.label}</span>
            <span class="detail-value">${f.value}</span>
        </div>
    `).join('');
    modal.classList.add('open');
}

/**
 * Setup job modal event listeners
 */
export function setupJobModalListeners() {
    const jobModal = document.getElementById('jobModal');
    const closeModal = document.getElementById('closeModal');
    
    if (closeModal && jobModal) {
        closeModal.addEventListener('click', () => {
            jobModal.classList.remove('open');
        });
    }
}
