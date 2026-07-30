'use strict';

(function installProtectedOperationalReset() {
  const FUNCTION_NAME = 'admin-reset-data';
  const PANEL_ID = 'systemDataResetPanel';
  const MODAL_ID = 'systemDataResetModal';
  const CONFIRMATION_PHRASE = 'RESET ALL RECORDS';
  let lastPreview = { reports: 0, verifications: 0, audit_logs: 0 };
  let installing = false;
  let previousBodyOverflow = '';

  function currentProfile() {
    return typeof profile !== 'undefined' ? profile : null;
  }

  function currentDatabase() {
    return typeof db !== 'undefined' ? db : null;
  }

  function isAdministrator() {
    return currentProfile()?.role === 'admin';
  }

  function formatCount(value) {
    return Number(value || 0).toLocaleString('en-PH');
  }

  function functionUrl() {
    const base = String(window.KSC_CONFIG?.supabaseUrl || '').replace(/\/$/, '');
    return `${base}/functions/v1/${FUNCTION_NAME}`;
  }

  function installStyles() {
    if (document.getElementById('systemDataResetStyles')) return;
    const style = document.createElement('style');
    style.id = 'systemDataResetStyles';
    style.textContent = `
      .admin-reset-panel{margin-top:18px;border-color:#f4c7c3;background:linear-gradient(180deg,#fff 0%,#fffafa 100%)}
      .admin-reset-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
      .admin-reset-head h3{margin:0;color:#8f1d16}.admin-reset-head p{margin:6px 0 0;color:#667085;font-size:12px;line-height:1.55}
      .admin-reset-label{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid #f0b8b3;border-radius:999px;background:#fff1f0;color:#a5231a;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
      .admin-reset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}
      .admin-reset-stat{padding:15px;border:1px solid #eadfdf;border-radius:14px;background:#fff}
      .admin-reset-stat span{display:block;color:#667085;font-size:11px}.admin-reset-stat strong{display:block;margin-top:6px;color:#172033;font-size:23px;line-height:1}
      .admin-reset-preserve{padding:14px 15px;border:1px solid #d7e7dc;border-radius:14px;background:#f3fbf5;color:#316342;font-size:12px;line-height:1.55}
      .admin-reset-preserve strong{display:block;margin-bottom:3px;color:#1f6d38}
      .admin-reset-status{min-height:20px;margin:12px 0 0;color:#667085;font-size:11px;line-height:1.45}
      .admin-reset-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}
      .btn.admin-reset-danger{background:#b42318;border-color:#b42318;color:#fff;box-shadow:0 7px 16px rgba(180,35,24,.18)}
      .btn.admin-reset-danger:hover:not(:disabled){background:#8f1d16;border-color:#8f1d16}.btn.admin-reset-danger:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
      body.system-reset-modal-open{overflow:hidden}
      .system-reset-modal{position:fixed;inset:0;z-index:42000;display:grid;place-items:center;padding:22px;isolation:isolate}
      .system-reset-modal.hidden{display:none}
      .system-reset-backdrop{position:absolute;inset:0;background:rgba(8,18,32,.72);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px)}
      .system-reset-dialog{position:relative;width:min(620px,100%);max-height:calc(100vh - 44px);overflow:auto;border:1px solid rgba(15,41,69,.12);border-radius:24px;background:#fff;box-shadow:0 36px 100px rgba(5,24,47,.4);animation:systemResetIn .18s ease-out}
      .system-reset-header{display:flex;align-items:flex-start;gap:14px;padding:24px;border-bottom:1px solid #edf1f5}
      .system-reset-icon{width:46px;height:46px;flex:0 0 46px;display:grid;place-items:center;border:1px solid #ffd1cd;border-radius:14px;background:#fff1f0;color:#b42318;font-size:23px;font-weight:900}
      .system-reset-heading{min-width:0;flex:1}.system-reset-heading h2{margin:0;color:#151f32;font-size:21px;letter-spacing:-.02em}.system-reset-heading p{margin:6px 0 0;color:#667085;font-size:12px;line-height:1.5}
      .system-reset-close{width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:#667085;font-size:24px;cursor:pointer}.system-reset-close:hover{background:#f2f4f7;color:#101828}
      .system-reset-body{display:grid;gap:16px;padding:22px 24px 6px}
      .system-reset-warning{padding:14px 15px;border:1px solid #f1c5c1;border-radius:14px;background:#fff7f6;color:#7a271a;font-size:12px;line-height:1.55}.system-reset-warning strong{display:block;margin-bottom:3px;color:#912018}
      .system-reset-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.system-reset-count{padding:12px;border:1px solid #e5eaf0;border-radius:12px;background:#f8fafc;text-align:center}.system-reset-count span{display:block;color:#667085;font-size:10px}.system-reset-count strong{display:block;margin-top:4px;color:#172033;font-size:20px}
      .system-reset-field label,.system-reset-confirm-label{display:block;margin-bottom:7px;color:#344054;font-size:12px;font-weight:750}
      .system-reset-field textarea,.system-reset-field input{width:100%;border:1px solid #cfd7e3;border-radius:11px;background:#fff;color:#172033;font:inherit;outline:none;transition:border-color .16s,box-shadow .16s}
      .system-reset-field textarea{min-height:86px;padding:11px 13px;resize:vertical}.system-reset-field input{height:44px;padding:0 13px}
      .system-reset-field textarea:focus,.system-reset-field input:focus{border-color:#1f6feb;box-shadow:0 0 0 4px rgba(31,111,235,.12)}
      .system-reset-instruction{margin:0 0 9px;color:#667085;font-size:11px;line-height:1.5}.system-reset-instruction code{padding:2px 5px;border-radius:5px;background:#f2f4f7;color:#344054;font-weight:800}
      .system-reset-check{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #e5eaf0;border-radius:12px;background:#fafbfc;color:#344054;font-size:12px;line-height:1.5}.system-reset-check input{width:18px;height:18px;margin-top:1px;accent-color:#b42318}
      .system-reset-message{min-height:18px;margin:0;color:#b42318;font-size:11px}
      .system-reset-actions{display:flex;justify-content:flex-end;gap:10px;padding:18px 24px 24px}.system-reset-actions button{min-width:126px;height:42px;border-radius:11px;font-weight:750;cursor:pointer}
      .system-reset-cancel{border:1px solid #d0d5dd;background:#fff;color:#344054}.system-reset-confirm{border:1px solid #b42318;background:#b42318;color:#fff}.system-reset-confirm:disabled{border-color:#edaaa5;background:#edaaa5;cursor:not-allowed}
      @keyframes systemResetIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
      @media(max-width:760px){
        .admin-reset-head{display:grid}.admin-reset-label{justify-self:start}.admin-reset-grid,.system-reset-counts{grid-template-columns:1fr}.admin-reset-actions{display:grid}.admin-reset-actions .btn{width:100%}
        .system-reset-modal{padding:12px}.system-reset-dialog{max-height:calc(100vh - 24px);border-radius:19px}.system-reset-header,.system-reset-body,.system-reset-actions{padding-left:17px;padding-right:17px}.system-reset-actions{flex-direction:column-reverse}.system-reset-actions button{width:100%}
      }
      @media(prefers-reduced-motion:reduce){.system-reset-dialog{animation:none}}
    `;
    document.head.appendChild(style);
  }

  async function invokeResetService(payload) {
    const database = currentDatabase();
    if (!database) throw new Error('The database connection is not ready.');

    const { data: sessionData, error: sessionError } = await database.auth.getSession();
    if (sessionError) throw new Error(sessionError.message || 'Unable to read the current login session.');
    const activeSession = sessionData?.session;
    if (!activeSession?.access_token) throw new Error('Your login session is no longer valid. Sign out and sign in again.');

    const response = await fetch(functionUrl(), {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${activeSession.access_token}`,
        apikey: window.KSC_CONFIG.supabasePublishableKey,
        'Content-Type': 'application/json',
        'x-client-info': 'kaking-store-cash-web/reset-data-1.0'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let result = null;
    try { result = text ? JSON.parse(text) : null; } catch (_) { result = text; }
    if (!response.ok) {
      const message = result?.error || result?.message || (typeof result === 'string' ? result : '') || `Reset service returned HTTP ${response.status}.`;
      throw new Error(message);
    }
    if (result?.error) throw new Error(result.error);
    return result || {};
  }

  function friendlyResetError(error) {
    const raw = String(error?.message || 'Unable to access the protected reset service.');
    if (/function not found|404/i.test(raw)) return 'The protected reset service is not deployed. Deploy the Supabase Edge Function named admin-reset-data.';
    if (/admin_reset_operational_data|schema cache|does not exist/i.test(raw)) return 'Run supabase/reset_data_extension.sql in the Supabase SQL Editor, then deploy the reset function again.';
    if (/invalid or expired session|authentication|required|unauthorized|401/i.test(raw)) return 'Your administrator session expired. Sign out, sign in, and retry.';
    if (/not authorized|system administrator|403/i.test(raw)) return 'Only an active System Administrator can reset operational records.';
    if (/failed to fetch|networkerror|load failed|cors/i.test(raw)) return 'The browser could not reach the protected reset service. Check the Edge Function deployment and internet connection.';
    return raw;
  }

  function updatePreviewDisplay(preview) {
    lastPreview = {
      reports: Number(preview?.reports || 0),
      verifications: Number(preview?.verifications || 0),
      audit_logs: Number(preview?.audit_logs || 0)
    };
    document.querySelectorAll('[data-reset-count="reports"]').forEach((element) => { element.textContent = formatCount(lastPreview.reports); });
    document.querySelectorAll('[data-reset-count="verifications"]').forEach((element) => { element.textContent = formatCount(lastPreview.verifications); });
    document.querySelectorAll('[data-reset-count="audit_logs"]').forEach((element) => { element.textContent = formatCount(lastPreview.audit_logs); });
    const total = lastPreview.reports + lastPreview.verifications + lastPreview.audit_logs;
    const button = document.getElementById('openSystemResetBtn');
    if (button) button.disabled = total === 0;
  }

  async function loadPreview(showLoader = false) {
    if (!isAdministrator()) return;
    const status = document.getElementById('systemResetStatus');
    if (status) status.textContent = 'Checking current record counts…';
    const refresh = document.getElementById('refreshSystemResetPreviewBtn');
    if (refresh) refresh.disabled = true;
    if (showLoader && typeof setLoading === 'function') setLoading(true, 'Checking reset scope…');

    try {
      const result = await invokeResetService({ action: 'preview' });
      updatePreviewDisplay(result.counts || result);
      if (status) {
        status.textContent = result.last_reset_at
          ? `Last protected reset: ${new Date(result.last_reset_at).toLocaleString('en-PH')}`
          : 'No previous protected reset was found.';
      }
    } catch (error) {
      console.error(error);
      updatePreviewDisplay({ reports: 0, verifications: 0, audit_logs: 0 });
      if (status) status.textContent = friendlyResetError(error);
    } finally {
      if (refresh) refresh.disabled = false;
      if (showLoader && typeof setLoading === 'function') setLoading(false);
    }
  }

  function ensurePanel() {
    if (!isAdministrator()) {
      document.getElementById(PANEL_ID)?.remove();
      return null;
    }
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    const administration = document.querySelector('[data-section="administration"]');
    const grid = administration?.querySelector('.admin-grid');
    if (!administration || !grid || installing) return null;
    installing = true;
    installStyles();

    panel = document.createElement('article');
    panel.id = PANEL_ID;
    panel.className = 'card admin-reset-panel';
    panel.innerHTML = `
      <div class="admin-reset-head">
        <div><h3>Data Reset and Recovery</h3><p>Permanently clear all operational finance records when starting a new clean cycle. This action is protected and fully logged.</p></div>
        <span class="admin-reset-label">Administrator Only</span>
      </div>
      <div class="admin-reset-grid" aria-label="Records selected for reset">
        <div class="admin-reset-stat"><span>Daily reports</span><strong data-reset-count="reports">—</strong></div>
        <div class="admin-reset-stat"><span>Deposit verifications</span><strong data-reset-count="verifications">—</strong></div>
        <div class="admin-reset-stat"><span>Previous audit entries</span><strong data-reset-count="audit_logs">—</strong></div>
      </div>
      <div class="admin-reset-preserve"><strong>System setup will be preserved</strong>Branches, user accounts, passwords, roles, permissions, and database structure are not deleted. A new audit entry records the administrator and reset reason.</div>
      <p id="systemResetStatus" class="admin-reset-status" aria-live="polite">Checking the protected reset service…</p>
      <div class="admin-reset-actions">
        <button id="refreshSystemResetPreviewBtn" class="btn secondary" type="button">Refresh Record Count</button>
        <button id="openSystemResetBtn" class="btn admin-reset-danger" type="button" disabled>Reset All Operational Records</button>
      </div>`;
    grid.insertAdjacentElement('afterend', panel);
    panel.querySelector('#refreshSystemResetPreviewBtn').addEventListener('click', () => loadPreview(true));
    panel.querySelector('#openSystemResetBtn').addEventListener('click', openResetModal);
    installing = false;
    loadPreview(false);
    return panel;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'system-reset-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="system-reset-backdrop" data-system-reset-dismiss="true"></div>
      <section class="system-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="systemResetTitle" aria-describedby="systemResetDescription">
        <header class="system-reset-header">
          <div class="system-reset-icon" aria-hidden="true">!</div>
          <div class="system-reset-heading"><h2 id="systemResetTitle">Reset all operational records?</h2><p id="systemResetDescription">This action permanently deletes financial records and cannot be undone from the web system.</p></div>
          <button class="system-reset-close" type="button" data-system-reset-dismiss="true" aria-label="Close reset confirmation">×</button>
        </header>
        <div class="system-reset-body">
          <div class="system-reset-warning"><strong>Export or verify your backup first</strong>Daily reports, deposit verifications, and previous audit entries will be removed in one database transaction. Do not continue unless the authorized records are already backed up.</div>
          <div class="system-reset-counts">
            <div class="system-reset-count"><span>Daily reports</span><strong data-reset-count="reports">0</strong></div>
            <div class="system-reset-count"><span>Verifications</span><strong data-reset-count="verifications">0</strong></div>
            <div class="system-reset-count"><span>Audit entries</span><strong data-reset-count="audit_logs">0</strong></div>
          </div>
          <div class="system-reset-field"><label for="systemResetReason">Reason for resetting records</label><textarea id="systemResetReason" maxlength="500" placeholder="Example: Authorized production reset before official store rollout"></textarea></div>
          <div class="system-reset-field"><label for="systemResetPhrase">Type the exact confirmation phrase</label><p class="system-reset-instruction">Enter <code>${CONFIRMATION_PHRASE}</code> exactly.</p><input id="systemResetPhrase" autocomplete="off" autocapitalize="characters" spellcheck="false" /></div>
          <label class="system-reset-check"><input id="systemResetAcknowledge" type="checkbox" /><span>I understand that these operational records will be permanently deleted and that restoration requires a separate database backup.</span></label>
          <p id="systemResetMessage" class="system-reset-message" aria-live="polite"></p>
        </div>
        <footer class="system-reset-actions">
          <button class="system-reset-cancel" type="button" data-system-reset-dismiss="true">Cancel</button>
          <button id="confirmSystemResetBtn" class="system-reset-confirm" type="button" disabled>Reset Records Permanently</button>
        </footer>
      </section>`;
    document.body.appendChild(modal);

    const reason = modal.querySelector('#systemResetReason');
    const phrase = modal.querySelector('#systemResetPhrase');
    const acknowledge = modal.querySelector('#systemResetAcknowledge');
    const confirm = modal.querySelector('#confirmSystemResetBtn');
    const message = modal.querySelector('#systemResetMessage');

    function syncState() {
      const reasonValid = reason.value.trim().length >= 10;
      const phraseValid = phrase.value.trim() === CONFIRMATION_PHRASE;
      confirm.disabled = !(reasonValid && phraseValid && acknowledge.checked);
      if (phrase.value && !phraseValid) message.textContent = 'The confirmation phrase does not match.';
      else if (reason.value && !reasonValid) message.textContent = 'Enter a clear reason containing at least 10 characters.';
      else message.textContent = '';
    }

    [reason, phrase, acknowledge].forEach((control) => control.addEventListener('input', syncState));
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-system-reset-dismiss="true"]')) closeResetModal();
    });
    confirm.addEventListener('click', executeReset);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeResetModal();
    });
    return modal;
  }

  async function openResetModal() {
    if (!isAdministrator()) {
      if (typeof showToast === 'function') showToast('Only a System Administrator can reset operational records.', 'error');
      return;
    }
    await loadPreview(true);
    const total = lastPreview.reports + lastPreview.verifications + lastPreview.audit_logs;
    if (total === 0) {
      if (typeof showToast === 'function') showToast('There are no operational records to reset.', 'normal');
      return;
    }

    const modal = ensureModal();
    modal.querySelector('#systemResetReason').value = '';
    modal.querySelector('#systemResetPhrase').value = '';
    modal.querySelector('#systemResetAcknowledge').checked = false;
    modal.querySelector('#confirmSystemResetBtn').disabled = true;
    modal.querySelector('#systemResetMessage').textContent = '';
    updatePreviewDisplay(lastPreview);
    previousBodyOverflow = document.body.style.overflow;
    document.body.classList.add('system-reset-modal-open');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(() => modal.querySelector('#systemResetReason').focus());
  }

  function closeResetModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('system-reset-modal-open');
    document.body.style.overflow = previousBodyOverflow;
  }

  async function executeReset() {
    const modal = ensureModal();
    const reason = modal.querySelector('#systemResetReason').value.trim();
    const confirmation = modal.querySelector('#systemResetPhrase').value.trim();
    const acknowledged = modal.querySelector('#systemResetAcknowledge').checked;
    const button = modal.querySelector('#confirmSystemResetBtn');

    if (!isAdministrator()) return;
    if (reason.length < 10 || confirmation !== CONFIRMATION_PHRASE || !acknowledged) return;
    button.disabled = true;
    if (typeof setLoading === 'function') setLoading(true, 'Resetting protected operational records…');

    try {
      const result = await invokeResetService({ action: 'reset', reason, confirmation, acknowledged });
      closeResetModal();
      const counts = result.deleted || {};
      if (typeof showToast === 'function') {
        showToast(`Reset completed: ${formatCount(counts.reports)} reports and ${formatCount(counts.verifications)} verifications removed.`, 'success');
      }
      if (typeof loadData === 'function') await loadData();
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      modal.querySelector('#systemResetMessage').textContent = friendlyResetError(error);
      button.disabled = false;
    } finally {
      if (typeof setLoading === 'function') setLoading(false);
    }
  }

  function monitorAccess() {
    ensurePanel();
    const observer = new MutationObserver(ensurePanel);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    window.setInterval(ensurePanel, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monitorAccess, { once: true });
  else monitorAccess();
})();
