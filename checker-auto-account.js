'use strict';

(function installCheckerAutoAccountFeature() {
  if (window.__KSC_CHECKER_AUTO_ACCOUNT_V1__) return;
  window.__KSC_CHECKER_AUTO_ACCOUNT_V1__ = true;

  const CONTROL_ID = 'checkerAutoAccountUnassigned';
  const PAYMENT_KEYS = ['cash', 'gcash', 'maya', 'credit', 'debit', 'cheque', 'salmon', 'other'];
  const originalFetch = window.fetch.bind(window);
  let lastSelectedUserId = null;
  let metadataBusy = false;
  let metadataQueued = false;

  function currentRole() {
    return document.getElementById('userRole')?.value || '';
  }

  function scopeAllControl() {
    return document.getElementById('checkerScopeAll');
  }

  function autoControl() {
    return document.getElementById(CONTROL_ID);
  }

  function installStyles() {
    if (document.getElementById('checkerAutoAccountStyles')) return;
    const style = document.createElement('style');
    style.id = 'checkerAutoAccountStyles';
    style.textContent = `
      .checker-auto-account-option{
        display:flex;align-items:flex-start;gap:10px;margin:11px 0 0;padding:12px 13px;
        border:1px solid #bed7c8;border-radius:11px;background:#f4fbf6;color:#284c35;
        font-size:11px;font-weight:650;line-height:1.45;
      }
      .checker-auto-account-option input{width:18px;height:18px;flex:0 0 18px;margin:1px 0 0;accent-color:#16824b}
      .checker-auto-account-option strong{display:block;margin-bottom:2px;color:#176b3c;font-size:11px}
      .checker-auto-account-option small{display:block;color:#577363;font-size:9px;font-weight:500;line-height:1.5}
      .checker-auto-account-option.disabled{opacity:.52;background:#f3f6f4;border-color:#d9e2dc}
      .checker-auto-account-note{
        margin-top:9px;padding:10px 12px;border:1px solid #bed7c8;border-radius:10px;
        background:#f4fbf6;color:#2f6242;font-size:10px;line-height:1.5;
      }
      .recon-auto-note{display:block!important;margin-top:4px;color:#47715a!important;font-size:8px!important;line-height:1.35!important;white-space:normal!important}
      @media(max-width:680px){
        .checker-auto-account-option{align-items:flex-start;text-align:left!important}
        .checker-auto-account-note{text-align:center}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureControl() {
    installStyles();
    const editor = document.getElementById('checkerScopeEditor');
    const grid = editor?.querySelector('.checker-scope-grid');
    if (!editor || !grid) return null;

    let input = autoControl();
    if (input) return input;

    const label = document.createElement('label');
    label.className = 'checker-auto-account-option';
    label.innerHTML = `
      <input id="${CONTROL_ID}" type="checkbox" />
      <span>
        <strong>Auto-account for unassigned payment types</strong>
        <small>In Branch Reconciliation, unselected payment types are carried at the store-reported amounts. The checker still verifies only the selected fields, and any scoped difference remains visible.</small>
      </span>`;
    grid.insertAdjacentElement('afterend', label);
    input = label.querySelector('input');
    input.addEventListener('change', () => {
      input.dataset.userChanged = 'true';
    });
    synchronizeAvailability();
    return input;
  }

  function synchronizeAvailability() {
    const input = ensureControl();
    if (!input) return;
    const fullScope = scopeAllControl()?.checked !== false;
    const checkerRole = currentRole() === 'checker';
    const disabled = !checkerRole || fullScope;
    input.disabled = disabled;
    if (disabled) input.checked = false;
    input.closest('.checker-auto-account-option')?.classList.toggle('disabled', disabled);
  }

  function selectedAdminUser() {
    try {
      const id = typeof selectedAdminUserId !== 'undefined' ? selectedAdminUserId : null;
      if (!id || !Array.isArray(adminUsers)) return null;
      return adminUsers.find((item) => item.id === id) || null;
    } catch (_) {
      return null;
    }
  }

  function applySelectedUserScope(force = false) {
    const input = ensureControl();
    if (!input) return;
    const user = selectedAdminUser();
    const userId = user?.id || null;
    if (!force && userId === lastSelectedUserId) {
      synchronizeAvailability();
      return;
    }
    lastSelectedUserId = userId;
    input.checked = Boolean(user?.checker_scope?.auto_account_unassigned) && user?.checker_scope?.all === false;
    delete input.dataset.userChanged;
    synchronizeAvailability();
  }

  function scopeFromEditor(existingScope = {}) {
    const all = scopeAllControl()?.checked !== false;
    const selected = [...document.querySelectorAll('[data-checker-scope-key]:checked')]
      .map((input) => input.dataset.checkerScopeKey)
      .filter((key) => PAYMENT_KEYS.includes(key));

    return {
      ...existingScope,
      all,
      payment_types: all ? [...PAYMENT_KEYS] : selected,
      auto_account_unassigned: !all && autoControl()?.checked === true
    };
  }

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
    return String(input || '');
  }

  window.fetch = async function checkerAutoAccountFetch(input, init = {}) {
    const url = requestUrl(input);
    const method = String(init.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
    let nextInit = init;

    if (method === 'POST' && /\/functions\/v1\/admin-users(?:\?|$)/.test(url) && typeof init.body === 'string') {
      try {
        const payload = JSON.parse(init.body);
        if (payload?.action === 'create_user' || payload?.action === 'update_user') {
          const role = String(payload.role || currentRole());
          payload.checker_scope = role === 'checker'
            ? scopeFromEditor(payload.checker_scope || {})
            : { all: true, payment_types: [...PAYMENT_KEYS], auto_account_unassigned: false };
          nextInit = { ...init, body: JSON.stringify(payload) };
        }
      } catch (_) {
        // Leave unrelated or non-JSON requests untouched.
      }
    }

    return originalFetch(input, nextInit);
  };

  async function loadCurrentCheckerSetting() {
    try {
      if (typeof profile === 'undefined' || profile?.role !== 'checker' || typeof db === 'undefined' || !db || typeof session === 'undefined' || !session?.user?.id) return;
      const result = await db.from('profiles').select('checker_scope').eq('id', session.user.id).maybeSingle();
      if (result.error) return;
      window.KSC_CURRENT_CHECKER_AUTO_ACCOUNT = result.data?.checker_scope?.auto_account_unassigned === true;
      renderCheckerNotice();
    } catch (_) {
      // This enhancement must never block checker access.
    }
  }

  function renderCheckerNotice() {
    const panel = document.getElementById('checkerAuthorizedFields');
    if (!panel) return;
    panel.querySelector('.checker-auto-account-note')?.remove();
    if (window.KSC_CURRENT_CHECKER_AUTO_ACCOUNT !== true) return;
    const note = document.createElement('div');
    note.className = 'checker-auto-account-note';
    note.textContent = 'Branch Reconciliation will carry unassigned payment types at the store-reported amounts. Your verification and difference still apply only to the authorized fields shown above.';
    panel.appendChild(note);
  }

  function verificationObject(report) {
    const value = report?.deposit_verifications;
    return Array.isArray(value) ? value[0] || null : value || null;
  }

  async function hydrateVerificationMetadata() {
    if (metadataBusy) {
      metadataQueued = true;
      return;
    }

    try {
      if (typeof profile === 'undefined' || profile?.role === 'checker' || typeof db === 'undefined' || !db || typeof reports === 'undefined' || !Array.isArray(reports)) return;
      const ids = reports.map((report) => report.id).filter(Boolean);
      if (!ids.length) return;

      metadataBusy = true;
      const result = await db
        .from('deposit_verifications')
        .select('report_id,expected_amount,checked_payment_types,auto_account_unassigned')
        .in('report_id', ids);

      if (result.error) {
        if (!/auto_account_unassigned|schema cache|column/i.test(result.error.message || '')) console.error('Unable to load reconciliation metadata:', result.error);
        return;
      }

      const byReport = new Map((result.data || []).map((item) => [item.report_id, item]));
      reports.forEach((report) => {
        const metadata = byReport.get(report.id);
        const verification = verificationObject(report);
        if (!metadata || !verification) return;
        verification.expected_amount = metadata.expected_amount;
        verification.checked_payment_types = metadata.checked_payment_types;
        verification.auto_account_unassigned = metadata.auto_account_unassigned === true;
      });

      document.dispatchEvent(new Event('ksc:reconciliation-metadata-ready'));
    } catch (error) {
      console.error('Unable to hydrate reconciliation metadata:', error);
    } finally {
      metadataBusy = false;
      if (metadataQueued) {
        metadataQueued = false;
        window.setTimeout(hydrateVerificationMetadata, 50);
      }
    }
  }

  function bindEvents() {
    document.addEventListener('change', (event) => {
      if (event.target?.id === 'checkerScopeAll' || event.target?.id === 'userRole') {
        window.requestAnimationFrame(synchronizeAvailability);
      }
    }, true);

    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#adminUserRows tr,[data-admin-user-id]')) {
        window.setTimeout(() => applySelectedUserScope(true), 0);
      }
      if (event.target.closest?.('#userResetBtn')) {
        window.setTimeout(() => {
          lastSelectedUserId = null;
          const input = ensureControl();
          if (input) input.checked = false;
          synchronizeAvailability();
        }, 0);
      }
    }, true);

    document.addEventListener('ksc:reporting-period-loaded', hydrateVerificationMetadata);
    document.addEventListener('ksc:reconciliation-metadata-ready', renderCheckerNotice);
    window.addEventListener('pageshow', () => {
      applySelectedUserScope(true);
      loadCurrentCheckerSetting();
      hydrateVerificationMetadata();
    });
  }

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === 1
      && (node.matches?.('#checkerScopeEditor,#checkerAuthorizedFields,#adminUserRows')
        || node.querySelector?.('#checkerScopeEditor,#checkerAuthorizedFields,#adminUserRows'))));
    if (!relevant) return;
    window.requestAnimationFrame(() => {
      ensureControl();
      applySelectedUserScope();
      renderCheckerNotice();
    });
  });

  function initialize() {
    installStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    ensureControl();
    bindEvents();
    applySelectedUserScope(true);
    loadCurrentCheckerSetting();
    hydrateVerificationMetadata();
    window.setInterval(() => {
      ensureControl();
      applySelectedUserScope();
    }, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
