'use strict';

(function installJulySampleDataGenerator() {
  if (window.__KSC_JULY_SAMPLE_DATA_V1__) return;
  window.__KSC_JULY_SAMPLE_DATA_V1__ = true;

  const FUNCTION_NAME = 'admin-sample-data';
  const PANEL_ID = 'julySampleDataPanel';
  const MODAL_ID = 'julySampleDataModal';
  const CONFIRMATION_PHRASE = 'GENERATE JULY 2026 SAMPLE DATA';
  const PERIOD = { from: '2026-07-01', to: '2026-07-31' };
  let preview = { active_branches: 0, expected_reports: 0, existing_reports: 0, can_generate: false };
  let installing = false;
  let generating = false;

  function currentProfile() {
    try { return typeof profile !== 'undefined' ? profile : null; }
    catch (_) { return null; }
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
    if (document.getElementById('julySampleDataStyles')) return;
    const style = document.createElement('style');
    style.id = 'julySampleDataStyles';
    style.textContent = `
      .sample-data-panel{margin-top:18px;border-color:#bfd8f7;background:linear-gradient(180deg,#fff 0%,#f8fbff 100%)}
      .sample-data-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
      .sample-data-head h3{margin:0;color:#164f91}.sample-data-head p{margin:6px 0 0;color:#66758a;font-size:12px;line-height:1.55}
      .sample-data-label{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid #b9d3f2;border-radius:999px;background:#eef6ff;color:#175da8;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
      .sample-data-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}
      .sample-data-stat{padding:15px;border:1px solid #dbe7f4;border-radius:14px;background:#fff}.sample-data-stat span{display:block;color:#66758a;font-size:11px}.sample-data-stat strong{display:block;margin-top:6px;color:#17243a;font-size:23px;line-height:1}
      .sample-data-detail{padding:14px 15px;border:1px solid #d8e7f7;border-radius:14px;background:#f5f9ff;color:#315a83;font-size:11px;line-height:1.55}.sample-data-detail strong{display:block;margin-bottom:3px;color:#174f87}
      .sample-data-status{min-height:20px;margin:12px 0 0;color:#66758a;font-size:11px;line-height:1.45}.sample-data-status.error{color:#b42318}.sample-data-status.success{color:#16713a}
      .sample-data-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}.sample-data-actions .btn{min-height:42px}
      .btn.sample-data-generate{background:#1769c2;border-color:#1769c2;color:#fff;box-shadow:0 7px 16px rgba(23,105,194,.18)}.btn.sample-data-generate:hover:not(:disabled){background:#12589f;border-color:#12589f}.btn.sample-data-generate:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
      .sample-data-modal{position:fixed;inset:0;z-index:42100;display:grid;place-items:center;padding:22px}.sample-data-modal.hidden{display:none}.sample-data-backdrop{position:absolute;inset:0;background:rgba(8,18,32,.7);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px)}
      .sample-data-dialog{position:relative;width:min(620px,100%);max-height:calc(100vh - 44px);overflow:auto;border:1px solid rgba(15,41,69,.12);border-radius:24px;background:#fff;box-shadow:0 36px 100px rgba(5,24,47,.38)}
      .sample-data-dialog header{display:flex;align-items:flex-start;gap:14px;padding:23px 24px;border-bottom:1px solid #edf1f5}.sample-data-dialog header h2{margin:0;color:#17243a;font-size:21px}.sample-data-dialog header p{margin:6px 0 0;color:#66758a;font-size:12px;line-height:1.5}
      .sample-data-icon{width:46px;height:46px;flex:0 0 46px;display:grid;place-items:center;border:1px solid #bfd8f7;border-radius:14px;background:#eef6ff;color:#1769c2;font-size:21px;font-weight:900}.sample-data-close{margin-left:auto;width:36px;height:36px;border:0;border-radius:10px;background:#f4f6f8;color:#66758a;font-size:22px;cursor:pointer}
      .sample-data-body{display:grid;gap:15px;padding:20px 24px 6px}.sample-data-warning{padding:13px 14px;border:1px solid #efd69f;border-radius:13px;background:#fff9e9;color:#745200;font-size:11px;line-height:1.55}.sample-data-warning strong{display:block;margin-bottom:3px;color:#6b4c00}
      .sample-data-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.sample-data-summary div{padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;text-align:center}.sample-data-summary span{display:block;color:#66758a;font-size:10px}.sample-data-summary strong{display:block;margin-top:4px;color:#17243a;font-size:19px}
      .sample-data-field{display:grid;gap:7px;color:#344054;font-size:12px;font-weight:750}.sample-data-field input{width:100%;height:44px;padding:0 13px;border:1px solid #cfd7e3;border-radius:11px;font:inherit}.sample-data-check{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #e5eaf0;border-radius:12px;background:#fafbfc;color:#344054;font-size:11px;line-height:1.5}.sample-data-check input{width:18px;height:18px;flex:0 0 18px;margin-top:1px;accent-color:#1769c2}
      .sample-data-message{min-height:18px;margin:0;color:#b42318;font-size:11px}.sample-data-dialog footer{display:flex;justify-content:flex-end;gap:10px;padding:18px 24px 24px}.sample-data-dialog footer button{min-width:130px;min-height:42px;border-radius:11px;font-weight:750}.sample-data-confirm{border:1px solid #1769c2;background:#1769c2;color:#fff}.sample-data-confirm:disabled{opacity:.5;cursor:not-allowed}
      body.sample-data-modal-open{overflow:hidden}
      @media(max-width:760px){.sample-data-head{display:grid}.sample-data-label{justify-self:start}.sample-data-grid,.sample-data-summary{grid-template-columns:1fr}.sample-data-actions{display:grid}.sample-data-actions .btn{width:100%}.sample-data-modal{padding:12px}.sample-data-dialog{max-height:calc(100vh - 24px);border-radius:19px}.sample-data-dialog header,.sample-data-body,.sample-data-dialog footer{padding-left:17px;padding-right:17px}.sample-data-dialog footer{display:grid}.sample-data-dialog footer button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function invokeService(payload) {
    if (typeof db === 'undefined' || !db) throw new Error('The database connection is not ready.');
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    const activeSession = data?.session;
    if (!activeSession?.access_token) throw new Error('Your administrator session expired. Sign out and sign in again.');

    const response = await fetch(functionUrl(), {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${activeSession.access_token}`,
        apikey: window.KSC_CONFIG.supabasePublishableKey,
        'Content-Type': 'application/json',
        'x-client-info': 'kaking-store-cash-web/sample-data-1.0'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let result = null;
    try { result = text ? JSON.parse(text) : null; } catch (_) { result = text; }
    if (!response.ok) throw new Error(result?.error || result?.message || String(result || `HTTP ${response.status}`));
    if (result?.error) throw new Error(result.error);
    return result || {};
  }

  function friendlyError(error) {
    const raw = String(error?.message || 'Unable to access the sample-data service.');
    if (/admin_generate_sample_data|schema cache|does not exist/i.test(raw)) return 'Run supabase/sample_data_extension.sql in Supabase SQL Editor, then redeploy admin-sample-data.';
    if (/function not found|404/i.test(raw)) return 'Deploy the Supabase Edge Function named admin-sample-data.';
    if (/already contains|July 2026 already/i.test(raw)) return raw;
    if (/invalid or expired session|authentication|required|unauthorized|401/i.test(raw)) return 'Your administrator session expired. Sign out and sign in again.';
    if (/not authorized|system administrator|403/i.test(raw)) return 'Only an active System Administrator can generate sample data.';
    if (/failed to fetch|networkerror|load failed|cors/i.test(raw)) return 'The browser could not reach admin-sample-data. Check its deployment and function logs.';
    return raw;
  }

  function updatePanel(nextPreview) {
    preview = {
      active_branches: Number(nextPreview?.active_branches || 0),
      expected_reports: Number(nextPreview?.expected_reports || 0),
      existing_reports: Number(nextPreview?.existing_reports || 0),
      can_generate: nextPreview?.can_generate === true
    };
    document.querySelectorAll('[data-sample-count="branches"]').forEach((el) => { el.textContent = formatCount(preview.active_branches); });
    document.querySelectorAll('[data-sample-count="expected"]').forEach((el) => { el.textContent = formatCount(preview.expected_reports); });
    document.querySelectorAll('[data-sample-count="existing"]').forEach((el) => { el.textContent = formatCount(preview.existing_reports); });
    const button = document.getElementById('openJulySampleDataBtn');
    if (button) button.disabled = !preview.can_generate || generating;
    const status = document.getElementById('julySampleDataStatus');
    if (status) {
      status.className = `sample-data-status ${preview.existing_reports > 0 ? 'error' : ''}`;
      status.textContent = preview.existing_reports > 0
        ? `Generation is blocked because July 2026 already contains ${formatCount(preview.existing_reports)} report(s).`
        : preview.active_branches > 0
          ? `Ready to create ${formatCount(preview.expected_reports)} reports across ${formatCount(preview.active_branches)} active branches.`
          : 'No active branches are available.';
    }
  }

  async function loadPreview(showLoader = false) {
    if (!isAdministrator()) return;
    const refresh = document.getElementById('refreshJulySamplePreviewBtn');
    if (refresh) refresh.disabled = true;
    if (showLoader && typeof setLoading === 'function') setLoading(true, 'Checking July sample-data availability…');
    try {
      updatePanel(await invokeService({ action: 'preview' }));
    } catch (error) {
      console.error('Sample-data preview failed:', error);
      const status = document.getElementById('julySampleDataStatus');
      if (status) { status.className = 'sample-data-status error'; status.textContent = friendlyError(error); }
      const button = document.getElementById('openJulySampleDataBtn');
      if (button) button.disabled = true;
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
    const administration = document.querySelector('[data-section="administration"]');
    const grid = administration?.querySelector('.admin-grid');
    if (!administration || !grid || installing) return null;
    installStyles();

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      installing = true;
      panel = document.createElement('article');
      panel.id = PANEL_ID;
      panel.className = 'card sample-data-panel';
      panel.innerHTML = `
        <div class="sample-data-head">
          <div><h3>July 2026 Performance Test Data</h3><p>Create a complete temporary month of realistic branch reports to test dashboards, date ranges, reconciliation, exports, permissions, and mobile performance.</p></div>
          <span class="sample-data-label">Administrator Test Tool</span>
        </div>
        <div class="sample-data-grid">
          <div class="sample-data-stat"><span>Active branches</span><strong data-sample-count="branches">—</strong></div>
          <div class="sample-data-stat"><span>Reports to create</span><strong data-sample-count="expected">—</strong></div>
          <div class="sample-data-stat"><span>Existing July reports</span><strong data-sample-count="existing">—</strong></div>
        </div>
        <div class="sample-data-detail"><strong>Realistic controlled coverage</strong>Creates all 31 days for every active branch, with approximately 20% pending verification plus matched, shortage, and overage cases. Every store remark is marked SAMPLE DATA JULY 2026.</div>
        <p id="julySampleDataStatus" class="sample-data-status" aria-live="polite">Checking the protected sample-data service…</p>
        <div class="sample-data-actions">
          <button id="refreshJulySamplePreviewBtn" class="btn secondary" type="button">Refresh Preview</button>
          <button id="openJulySampleDataBtn" class="btn sample-data-generate" type="button" disabled>Generate July Sample Data</button>
        </div>`;
      grid.insertAdjacentElement('afterend', panel);
      panel.querySelector('#refreshJulySamplePreviewBtn').addEventListener('click', () => loadPreview(true));
      panel.querySelector('#openJulySampleDataBtn').addEventListener('click', openModal);
      installing = false;
      loadPreview(false);
    }

    const resetPanel = document.getElementById('systemDataResetPanel');
    if (resetPanel && panel.nextElementSibling !== resetPanel) resetPanel.before(panel);
    return panel;
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'sample-data-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="sample-data-backdrop" data-sample-dismiss="true"></div>
      <section class="sample-data-dialog" role="dialog" aria-modal="true" aria-labelledby="julySampleDataTitle">
        <header>
          <div class="sample-data-icon" aria-hidden="true">31</div>
          <div><h2 id="julySampleDataTitle">Generate July 2026 sample data?</h2><p>This creates temporary financial test records for every active branch and every day in July.</p></div>
          <button class="sample-data-close" type="button" data-sample-dismiss="true" aria-label="Close">×</button>
        </header>
        <div class="sample-data-body">
          <div class="sample-data-warning"><strong>Use only for controlled testing</strong>The generator refuses to run when July already has reports. After testing, use Data Reset and Recovery to remove all operational records.</div>
          <div class="sample-data-summary">
            <div><span>Branches</span><strong data-sample-count="branches">0</strong></div>
            <div><span>Days</span><strong>31</strong></div>
            <div><span>Reports</span><strong data-sample-count="expected">0</strong></div>
          </div>
          <label class="sample-data-field">Type the exact confirmation phrase<input id="julySampleDataPhrase" autocomplete="off" spellcheck="false" placeholder="${CONFIRMATION_PHRASE}" /></label>
          <label class="sample-data-check"><input id="julySampleDataAcknowledge" type="checkbox" /><span>I understand these are temporary test records and will use the protected reset after completing the performance review.</span></label>
          <p id="julySampleDataMessage" class="sample-data-message" aria-live="polite"></p>
        </div>
        <footer><button class="btn ghost" type="button" data-sample-dismiss="true">Cancel</button><button id="confirmJulySampleDataBtn" class="sample-data-confirm" type="button" disabled>Generate Sample Data</button></footer>
      </section>`;
    document.body.appendChild(modal);

    const phrase = modal.querySelector('#julySampleDataPhrase');
    const acknowledge = modal.querySelector('#julySampleDataAcknowledge');
    const confirm = modal.querySelector('#confirmJulySampleDataBtn');
    const message = modal.querySelector('#julySampleDataMessage');
    function sync() {
      const phraseOkay = phrase.value.trim() === CONFIRMATION_PHRASE;
      confirm.disabled = generating || !phraseOkay || !acknowledge.checked;
      message.textContent = phrase.value && !phraseOkay ? 'The confirmation phrase does not match.' : '';
    }
    phrase.addEventListener('input', sync);
    acknowledge.addEventListener('change', sync);
    confirm.addEventListener('click', generate);
    modal.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-sample-dismiss="true"]')) closeModal();
    });
    return modal;
  }

  function openModal() {
    if (!isAdministrator() || !preview.can_generate) return;
    const modal = ensureModal();
    updatePanel(preview);
    modal.querySelector('#julySampleDataPhrase').value = '';
    modal.querySelector('#julySampleDataAcknowledge').checked = false;
    modal.querySelector('#confirmJulySampleDataBtn').disabled = true;
    modal.querySelector('#julySampleDataMessage').textContent = '';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sample-data-modal-open');
    window.setTimeout(() => modal.querySelector('#julySampleDataPhrase').focus(), 20);
  }

  function closeModal() {
    if (generating) return;
    const modal = document.getElementById(MODAL_ID);
    modal?.classList.add('hidden');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sample-data-modal-open');
  }

  function showJulyRange() {
    const mode = document.getElementById('reportMode');
    const anchor = document.getElementById('filterDate');
    const from = document.getElementById('filterFrom');
    const to = document.getElementById('filterTo');
    if (mode) mode.value = 'range';
    if (anchor) anchor.value = PERIOD.to;
    if (from) from.value = PERIOD.from;
    if (to) to.value = PERIOD.to;
    const apply = document.getElementById('applyReportingPeriod');
    if (apply) { apply.click(); return true; }
    return false;
  }

  async function generate() {
    if (generating || !isAdministrator()) return;
    const modal = ensureModal();
    const phrase = modal.querySelector('#julySampleDataPhrase').value.trim();
    const acknowledged = modal.querySelector('#julySampleDataAcknowledge').checked;
    generating = true;
    modal.querySelector('#confirmJulySampleDataBtn').disabled = true;
    if (typeof setLoading === 'function') setLoading(true, 'Generating July 2026 performance-test data…');

    try {
      const result = await invokeService({ action: 'generate', confirmation: phrase, acknowledged });
      generating = false;
      closeModal();
      if (typeof showToast === 'function') showToast(`July sample data generated: ${formatCount(result.reports)} reports.`, 'success');
      await loadPreview(false);
      const rangeApplied = showJulyRange();
      if (!rangeApplied && typeof loadData === 'function') await loadData();
    } catch (error) {
      console.error('Sample-data generation failed:', error);
      const message = modal.querySelector('#julySampleDataMessage');
      if (message) message.textContent = friendlyError(error);
      generating = false;
      modal.querySelector('#confirmJulySampleDataBtn').disabled = false;
    } finally {
      if (typeof setLoading === 'function') setLoading(false);
      updatePanel(preview);
    }
  }

  function monitor() {
    ensurePanel();
    const observer = new MutationObserver(ensurePanel);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    window.setInterval(ensurePanel, 1200);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !generating) closeModal();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monitor, { once: true });
  else monitor();
})();
