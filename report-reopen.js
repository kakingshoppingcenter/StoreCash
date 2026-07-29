'use strict';

(function installProtectedReportReopen() {
  const LOCKED_STATUSES = new Set(['pending_verification', 'matched', 'with_difference']);
  const MIN_REASON_LENGTH = 5;
  const MAX_REASON_LENGTH = 500;

  function installStyles() {
    if (document.getElementById('reportReopenStyles')) return;

    const style = document.createElement('style');
    style.id = 'reportReopenStyles';
    style.textContent = `
      .btn.reopen-action{background:#fff7e8;border:1px solid #e8b54c;color:#775000;box-shadow:none}
      .btn.reopen-action:hover:not(:disabled){background:#ffefc8;border-color:#d99b1d}
      .reopen-modal-backdrop{position:fixed;inset:0;z-index:10020;display:grid;place-items:center;padding:20px;background:rgba(7,19,35,.62);backdrop-filter:blur(4px)}
      .reopen-modal-backdrop.hidden{display:none}
      .reopen-modal{width:min(100%,500px);overflow:hidden;border:1px solid #dbe4ef;border-radius:18px;background:#fff;box-shadow:0 28px 75px rgba(10,31,58,.28)}
      .reopen-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 22px 14px}
      .reopen-modal-header h3{margin:0 0 6px;color:#0d2038;font-size:21px;line-height:1.2}
      .reopen-modal-header p{margin:0;color:#66758a;font-size:12px;line-height:1.55}
      .reopen-modal-close{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border:1px solid #dbe4ef;border-radius:9px;background:#fff;color:#43536a;font-size:20px;cursor:pointer}
      .reopen-modal-form{display:grid;gap:14px;padding:6px 22px 22px}
      .reopen-report-summary{display:grid;gap:7px;padding:12px 13px;border:1px solid #e1e8f1;border-radius:10px;background:#f8fafc;font-size:11px}
      .reopen-report-summary div{display:flex;justify-content:space-between;gap:14px}.reopen-report-summary span{color:#66758a}.reopen-report-summary strong{text-align:right;color:#203047}
      .reopen-modal-form textarea{min-height:105px;resize:vertical}
      .reopen-warning{margin:0;padding:11px 12px;border:1px solid #f1d18d;border-radius:9px;background:#fff8e8;color:#745200;font-size:10px;line-height:1.55}
      .reopen-message{min-height:17px;margin:0;color:#b42318;font-size:11px;font-weight:650;text-align:center}
      .reopen-modal-actions{display:grid;grid-template-columns:1fr 1.3fr;gap:10px}
      body.reopen-modal-open{overflow:hidden}
      @media(max-width:620px){.reopen-modal-backdrop{align-items:end;padding:0}.reopen-modal{width:100%;border-radius:18px 18px 0 0}.reopen-modal-header{padding:20px 18px 12px}.reopen-modal-form{padding:6px 18px 20px}.reopen-modal-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function currentVerification(report) {
    if (!report) return null;
    const raw = Array.isArray(report.deposit_verifications)
      ? report.deposit_verifications[0] || null
      : report.deposit_verifications || null;

    if (!raw || report.status === 'draft' || report.status === 'reopened') return null;

    if (report.status === 'pending_verification') {
      if (!report.submitted_at || !raw.verified_at) return null;
      if (new Date(raw.verified_at).getTime() < new Date(report.submitted_at).getTime()) return null;
    }

    return raw;
  }

  function canReopenSelectedReport() {
    return Boolean(
      selectedEntryReport &&
      LOCKED_STATUSES.has(selectedEntryReport.status) &&
      typeof hasPermission === 'function' &&
      hasPermission('reports_manage')
    );
  }

  function ensureReopenButton() {
    let button = document.getElementById('reopenReportBtn');
    if (button) return button;

    const actions = document.querySelector('#entryForm .actions');
    if (!actions) return null;

    button = document.createElement('button');
    button.id = 'reopenReportBtn';
    button.type = 'button';
    button.className = 'btn reopen-action hidden';
    button.textContent = 'Reopen Report';
    button.addEventListener('click', openReopenModal);
    actions.insertBefore(button, actions.firstChild);
    return button;
  }

  function updateReopenControls() {
    const button = ensureReopenButton();
    if (!button) return;

    const allowed = canReopenSelectedReport();
    button.classList.toggle('hidden', !allowed);
    button.disabled = !allowed;

    const message = document.getElementById('entryLockMessage');
    if (message && selectedEntryReport && LOCKED_STATUSES.has(selectedEntryReport.status)) {
      message.textContent = allowed
        ? 'This finalized report is locked. Select Reopen Report and record a reason before correcting store values.'
        : 'This finalized report is locked. An authorized administrator must reopen it before store values can be changed.';
    }
  }

  function createModal() {
    let backdrop = document.getElementById('reopenReportBackdrop');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.id = 'reopenReportBackdrop';
    backdrop.className = 'reopen-modal-backdrop hidden';
    backdrop.innerHTML = `
      <section class="reopen-modal" role="dialog" aria-modal="true" aria-labelledby="reopenReportTitle">
        <header class="reopen-modal-header">
          <div>
            <h3 id="reopenReportTitle">Reopen Finalized Report</h3>
            <p>Unlock the selected report for correction while retaining a complete audit history.</p>
          </div>
          <button id="reopenReportCloseBtn" class="reopen-modal-close" type="button" aria-label="Close reopen dialog">×</button>
        </header>
        <form id="reopenReportForm" class="reopen-modal-form" novalidate>
          <div id="reopenReportSummary" class="reopen-report-summary"></div>
          <label>
            Reason for Reopening
            <textarea id="reopenReportReason" maxlength="${MAX_REASON_LENGTH}" placeholder="Explain why this report must be corrected" required></textarea>
          </label>
          <p class="reopen-warning">The existing deposit verification will be treated as outdated. After corrections are submitted, the report must be verified again.</p>
          <p id="reopenReportMessage" class="reopen-message" aria-live="polite"></p>
          <div class="reopen-modal-actions">
            <button id="reopenReportCancelBtn" class="btn ghost" type="button">Cancel</button>
            <button id="reopenReportConfirmBtn" class="btn reopen-action" type="submit">Confirm Reopening</button>
          </div>
        </form>
      </section>`;

    document.body.appendChild(backdrop);
    document.getElementById('reopenReportCloseBtn').addEventListener('click', closeReopenModal);
    document.getElementById('reopenReportCancelBtn').addEventListener('click', closeReopenModal);
    document.getElementById('reopenReportForm').addEventListener('submit', submitReopen);
    document.getElementById('reopenReportReason').addEventListener('input', () => setModalMessage(''));
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) closeReopenModal();
    });
    return backdrop;
  }

  function setModalMessage(message) {
    const target = document.getElementById('reopenReportMessage');
    if (target) target.textContent = message;
  }

  function openReopenModal() {
    if (!canReopenSelectedReport()) {
      showToast('Select a finalized report and confirm that your account can manage reports.', 'error');
      return;
    }

    const report = selectedEntryReport;
    const branchName = report.branches?.name || branches.find((branch) => branch.id === report.branch_id)?.name || 'Unknown Branch';
    const summary = document.getElementById('reopenReportSummary') || createModal().querySelector('#reopenReportSummary');
    summary.innerHTML = `
      <div><span>Branch</span><strong>${escapeHtml(branchName)}</strong></div>
      <div><span>Business Date</span><strong>${escapeHtml(formatDate(report.business_date))}</strong></div>
      <div><span>Current Status</span><strong>${escapeHtml(statusLabel(report.status))}</strong></div>
      <div><span>Reported Total</span><strong>${escapeHtml(formatMoney(report.reported_total))}</strong></div>`;

    const backdrop = createModal();
    document.getElementById('reopenReportForm').reset();
    setModalMessage('');
    backdrop.classList.remove('hidden');
    document.body.classList.add('reopen-modal-open');
    window.setTimeout(() => document.getElementById('reopenReportReason')?.focus(), 30);
  }

  function closeReopenModal() {
    const backdrop = document.getElementById('reopenReportBackdrop');
    if (!backdrop || backdrop.classList.contains('hidden')) return;
    backdrop.classList.add('hidden');
    document.body.classList.remove('reopen-modal-open');
    document.getElementById('reopenReportForm')?.reset();
    setModalMessage('');
    document.getElementById('reopenReportBtn')?.focus();
  }

  function setSubmitting(submitting) {
    const confirm = document.getElementById('reopenReportConfirmBtn');
    const cancel = document.getElementById('reopenReportCancelBtn');
    const close = document.getElementById('reopenReportCloseBtn');
    if (confirm) {
      confirm.disabled = submitting;
      confirm.textContent = submitting ? 'Reopening Report…' : 'Confirm Reopening';
    }
    if (cancel) cancel.disabled = submitting;
    if (close) close.disabled = submitting;
  }

  async function submitReopen(event) {
    event.preventDefault();
    setModalMessage('');

    if (!canReopenSelectedReport()) {
      setModalMessage('This report is no longer eligible for reopening. Refresh and try again.');
      return;
    }

    const reportId = selectedEntryReport.id;
    const reason = document.getElementById('reopenReportReason').value.trim();
    if (reason.length < MIN_REASON_LENGTH) {
      setModalMessage(`Enter a clear reason containing at least ${MIN_REASON_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    setLoading(true, 'Reopening finalized report…');
    try {
      const { error } = await db.rpc('reopen_daily_report', {
        p_report_id: reportId,
        p_reason: reason
      });
      if (error) throw error;

      closeReopenModal();
      showToast('Report reopened successfully. Correct the values, then submit it for verification again.', 'success');
      await loadData();
      loadEntryReport();
    } catch (error) {
      console.error('Report reopening failed:', error);
      const raw = String(error?.message || 'Unable to reopen the report.');
      if (/function .*reopen_daily_report.*does not exist|schema cache/i.test(raw)) {
        setModalMessage('Run supabase/report_reopen_extension.sql in the Supabase SQL Editor, then retry.');
      } else if (/not authorized|permission/i.test(raw)) {
        setModalMessage('Your account is not authorized to reopen finalized reports.');
      } else {
        setModalMessage(raw);
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  }

  function preserveOriginalSubmitter() {
    const originalEntryPayload = entryPayload;
    entryPayload = function (status) {
      const payload = originalEntryPayload(status);
      if (selectedEntryReport?.submitted_by) payload.submitted_by = selectedEntryReport.submitted_by;
      return payload;
    };
  }

  function ignoreOutdatedVerification() {
    verificationFor = function (report) {
      return currentVerification(report);
    };
  }

  function wrapEntryStateFunctions() {
    const originalSetEntryLocked = setEntryLocked;
    setEntryLocked = function (locked) {
      originalSetEntryLocked(locked);
      updateReopenControls();
    };

    const originalLoadEntryReport = loadEntryReport;
    loadEntryReport = function () {
      const result = originalLoadEntryReport();
      updateReopenControls();
      return result;
    };

    const originalClearEntryForm = clearEntryForm;
    clearEntryForm = function () {
      const result = originalClearEntryForm();
      updateReopenControls();
      return result;
    };
  }

  function bindKeyboardControls() {
    document.addEventListener('keydown', (event) => {
      const backdrop = document.getElementById('reopenReportBackdrop');
      if (event.key === 'Escape' && backdrop && !backdrop.classList.contains('hidden')) {
        const confirm = document.getElementById('reopenReportConfirmBtn');
        if (!confirm?.disabled) closeReopenModal();
      }
    });
  }

  installStyles();
  ensureReopenButton();
  createModal();
  preserveOriginalSubmitter();
  ignoreOutdatedVerification();
  wrapEntryStateFunctions();
  bindKeyboardControls();
  updateReopenControls();
})();