'use strict';

(function installSignedOutDomCleanup() {
  if (window.__KSC_SIGNED_OUT_DOM_CLEANUP__) return;
  window.__KSC_SIGNED_OUT_DOM_CLEANUP__ = true;

  let scrubbing = false;
  let scrubQueued = false;

  function isLocked() {
    const shell = document.getElementById('appShell');
    return document.body.classList.contains('ksc-auth-locked')
      || shell?.hidden
      || shell?.getAttribute('aria-hidden') === 'true';
  }

  function clearHtml(id, html = '') {
    const target = document.getElementById(id);
    if (target) target.innerHTML = html;
  }

  function clearValue(id, value = '') {
    const target = document.getElementById(id);
    if (target && 'value' in target) target.value = value;
  }

  function removeElement(id) {
    document.getElementById(id)?.remove();
  }

  function scrubSignedOutDom() {
    if (scrubbing || !isLocked()) return;
    scrubbing = true;
    try {
      // Analytics contains branch names and financial figures. It is rebuilt
      // automatically by renderMetrics after the next authorized sign-in.
      removeElement('dashboardAnalytics');

      ['reportRows', 'auditRows', 'adminBranchRows', 'adminUserRows', 'branchBars', 'paymentMixLegend']
        .forEach((id) => clearHtml(id));

      clearHtml('executiveSummary', '<div class="empty-state">Sign in to view authorized report information.</div>');
      clearHtml('checkerReportSelect', '<option value="">Sign in required</option>');
      clearHtml('summaryReportSelect', '<option value="">Sign in required</option>');
      clearHtml('branch');

      ['branchDeleteSummary', 'systemResetMessage', 'systemResetStatus'].forEach((id) => clearHtml(id));
      // Do not clear loginPassword here. This scrub runs repeatedly while the
      // login page is open, which would erase characters while the user types.
      // auth-security.js already clears the login password once during sign-out.
      ['branchDeleteConfirmation', 'systemResetReason', 'systemResetPhrase', 'userPassword']
        .forEach((id) => clearValue(id));

      document.querySelectorAll('[data-reset-count]').forEach((target) => { target.textContent = '0'; });
      document.querySelectorAll('#paymentFields input').forEach((input) => { input.value = '0'; });

      const branchDelete = document.getElementById('branchDeleteBackdrop');
      if (branchDelete) branchDelete.classList.add('hidden');
      const resetModal = document.getElementById('systemDataResetModal');
      if (resetModal) {
        resetModal.classList.add('hidden');
        resetModal.setAttribute('aria-hidden', 'true');
      }

      document.body.classList.remove('branch-delete-open', 'system-reset-modal-open');
      document.body.style.removeProperty('overflow');
    } finally {
      scrubbing = false;
    }
  }

  function queueScrub() {
    if (scrubQueued) return;
    scrubQueued = true;
    window.setTimeout(() => {
      scrubQueued = false;
      scrubSignedOutDom();
    }, 0);
  }

  const observer = new MutationObserver(() => {
    if (isLocked()) queueScrub();
    else {
      // The core loader controls this overlay through the hidden class, so do
      // not leave an HTML hidden attribute behind after reauthorization.
      document.getElementById('loadingOverlay')?.removeAttribute('hidden');
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'hidden', 'aria-hidden']
  });

  window.setInterval(() => {
    if (isLocked()) scrubSignedOutDom();
  }, 1000);

  queueScrub();
})();
