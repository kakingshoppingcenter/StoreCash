'use strict';

(function installBranchSubmissionFilters() {
  if (window.__KSC_BRANCH_SUBMISSION_FILTERS_V2__) return;
  window.__KSC_BRANCH_SUBMISSION_FILTERS_V2__ = true;

  const STATUS_OPTIONS = [
    ['', 'All Statuses'],
    ['matched', 'Matched'],
    ['pending_verification', 'Pending Verification'],
    ['with_difference', 'With Difference'],
    ['draft', 'Draft'],
    ['reopened', 'Reopened']
  ];

  let framePending = false;
  let controlsReady = false;
  let restored = false;
  let rowObserver = null;
  let branchSignature = '';

  function installStyles() {
    if (document.getElementById('kscBranchSubmissionFilterStyles')) return;

    const style = document.createElement('style');
    style.id = 'kscBranchSubmissionFilterStyles';
    style.textContent = `
      .table-card .table-controls.branch-report-filter-controls{
        width:min(680px,100%)!important;
        display:grid!important;
        grid-template-columns:minmax(210px,1.35fr) minmax(145px,.8fr) minmax(165px,.9fr)!important;
        align-items:end!important;
        gap:9px!important;
      }
      .branch-report-filter-controls .branch-filter-field{
        display:grid!important;
        gap:5px!important;
        min-width:0!important;
        margin:0!important;
        color:#5e6e83!important;
        font-size:9px!important;
        font-weight:800!important;
        line-height:1.2!important;
        letter-spacing:.035em!important;
        text-transform:uppercase!important;
      }
      .branch-report-filter-controls input,
      .branch-report-filter-controls select{
        width:100%!important;
        min-width:0!important;
        min-height:42px!important;
        height:42px!important;
        margin:0!important;
        padding:9px 11px!important;
        border:1px solid #d5dfeb!important;
        border-radius:10px!important;
        background:#fff!important;
        color:#213149!important;
        font-size:12px!important;
        font-weight:600!important;
        line-height:1.2!important;
        text-transform:none!important;
        letter-spacing:normal!important;
      }
      .branch-report-filter-controls input:focus,
      .branch-report-filter-controls select:focus{
        outline:3px solid rgba(23,111,229,.12)!important;
        border-color:#176fe5!important;
      }
      #reportRows tr.branch-filter-hidden{display:none!important}

      @media(max-width:1180px){
        .table-card .card-head:has(.branch-report-filter-controls){
          display:grid!important;
          grid-template-columns:minmax(0,1fr)!important;
          gap:12px!important;
        }
        .table-card .table-controls.branch-report-filter-controls{width:100%!important}
      }

      @media(max-width:760px){
        html body .table-card .table-controls.branch-report-filter-controls{
          width:100%!important;
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:8px!important;
        }
        html body .branch-report-filter-controls .branch-filter-search-field{grid-column:1/-1!important}
        html body .branch-report-filter-controls .branch-filter-field{
          gap:4px!important;
          font-size:8.5px!important;
          text-align:left!important;
        }
        html body .branch-report-filter-controls input,
        html body .branch-report-filter-controls select{
          min-height:44px!important;
          height:44px!important;
          padding:9px 10px!important;
          border-radius:11px!important;
          font-size:14px!important;
          text-align:left!important;
        }
      }

      @media(max-width:370px){
        html body .table-card .table-controls.branch-report-filter-controls{grid-template-columns:1fr!important}
        html body .branch-report-filter-controls .branch-filter-search-field{grid-column:1!important}
      }
    `;
    document.body.appendChild(style);
  }

  function sourceReports() {
    try {
      return Array.isArray(reports) ? reports : [];
    } catch (_) {
      return [];
    }
  }

  function storageKey() {
    try {
      return `ksc:branch-submission-filters:${session?.user?.id || 'anonymous'}`;
    } catch (_) {
      return 'ksc:branch-submission-filters:anonymous';
    }
  }

  function makeField(className, caption, control) {
    const field = document.createElement('label');
    field.className = `branch-filter-field ${className}`;
    const title = document.createElement('span');
    title.textContent = caption;
    field.append(title, control);
    return field;
  }

  function ensureControls() {
    installStyles();

    const search = document.getElementById('reportSearch');
    const controls = search?.closest('.table-controls');
    if (!search || !controls) return false;

    controls.classList.add('branch-report-filter-controls');
    controls.setAttribute('aria-label', 'Branch submission filters');

    if (!search.closest('.branch-filter-search-field')) {
      search.placeholder = 'Search branch or status';
      search.setAttribute('aria-label', 'Search branch submissions');
      controls.prepend(makeField('branch-filter-search-field', 'Search', search));
    }

    if (!document.getElementById('reportBranchFilter')) {
      const branch = document.createElement('select');
      branch.id = 'reportBranchFilter';
      branch.setAttribute('aria-label', 'Filter submissions by branch');
      branch.innerHTML = '<option value="">All Branches</option>';
      branch.addEventListener('change', queueApply);
      controls.appendChild(makeField('branch-filter-branch-field', 'Branch', branch));
    }

    if (!document.getElementById('reportStatusFilter')) {
      const status = document.createElement('select');
      status.id = 'reportStatusFilter';
      status.setAttribute('aria-label', 'Filter submissions by status');
      status.innerHTML = STATUS_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
      status.addEventListener('change', queueApply);
      controls.appendChild(makeField('branch-filter-status-field', 'Status', status));
    }

    if (!controlsReady) {
      search.addEventListener('input', () => window.setTimeout(queueApply, 0));
      controlsReady = true;
    }

    syncBranchChoices();
    restoreChoices();
    return true;
  }

  function syncBranchChoices() {
    const select = document.getElementById('reportBranchFilter');
    if (!select) return;

    const unique = new Map();
    sourceReports().forEach((report) => {
      const id = String(report?.branch_id || '').trim();
      if (!id) return;
      const name = String(report?.branches?.name || report?.branches?.code || 'Unknown Branch').trim();
      if (!unique.has(id)) unique.set(id, name);
    });

    const entries = [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1], 'en', { sensitivity: 'base' }));
    const signature = JSON.stringify(entries);
    if (signature === branchSignature) return;
    branchSignature = signature;

    const previous = select.value;
    select.innerHTML = '<option value="">All Branches</option>' + entries
      .map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`)
      .join('');
    select.value = entries.some(([id]) => id === previous) ? previous : '';
  }

  function restoreChoices() {
    if (restored) return;
    restored = true;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || '{}');
      const branch = document.getElementById('reportBranchFilter');
      const status = document.getElementById('reportStatusFilter');
      if (branch && [...branch.options].some((option) => option.value === saved.branch)) branch.value = saved.branch || '';
      if (status && [...status.options].some((option) => option.value === saved.status)) status.value = saved.status || '';
    } catch (_) {
      // Storage is optional.
    }
  }

  function saveChoices() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        branch: document.getElementById('reportBranchFilter')?.value || '',
        status: document.getElementById('reportStatusFilter')?.value || ''
      }));
    } catch (_) {
      // Storage is optional.
    }
  }

  function syncEmptyState(show) {
    const body = document.getElementById('reportRows');
    if (!body) return;
    let row = body.querySelector('.branch-filter-empty');

    if (show && !row) {
      row = document.createElement('tr');
      row.className = 'branch-filter-empty';
      row.innerHTML = '<td colspan="8" class="empty-state">No submissions match the selected branch and status.</td>';
      body.appendChild(row);
    } else if (!show && row) {
      row.remove();
    }
  }

  function applyFilters() {
    framePending = false;
    if (!ensureControls()) return;

    const branch = document.getElementById('reportBranchFilter')?.value || '';
    const status = document.getElementById('reportStatusFilter')?.value || '';
    const reportsById = new Map(sourceReports().map((report) => [String(report.id), report]));
    const rows = [...document.querySelectorAll('#reportRows tr[data-report-id]')];
    let visible = 0;

    rows.forEach((row) => {
      const report = reportsById.get(String(row.dataset.reportId));
      const matches = Boolean(
        report
        && (!branch || String(report.branch_id || '') === branch)
        && (!status || String(report.status || '') === status)
      );

      row.hidden = !matches;
      row.classList.toggle('branch-filter-hidden', !matches);
      if (matches) {
        row.style.removeProperty('display');
        visible += 1;
      } else {
        row.style.setProperty('display', 'none', 'important');
      }
    });

    syncEmptyState(rows.length > 0 && visible === 0);
    saveChoices();
    document.dispatchEvent(new CustomEvent('ksc:branch-submission-filtered', {
      detail: { visible, total: rows.length, branch, status }
    }));
  }

  function queueApply() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(applyFilters);
  }

  function wrapRenderer() {
    try {
      if (typeof renderReports !== 'function' || renderReports.__kscBranchStatusFilters) return;
      const original = renderReports;
      const wrapped = function renderReportsWithBranchStatusFilters() {
        original();
        syncBranchChoices();
        queueApply();
      };
      wrapped.__kscBranchStatusFilters = true;
      wrapped.__kscBaseRenderReports = original;
      renderReports = wrapped;
    } catch (_) {
      // DOM observation remains as a safe fallback.
    }
  }

  function observeRows() {
    const body = document.getElementById('reportRows');
    if (!body || rowObserver) return;
    rowObserver = new MutationObserver((mutations) => {
      const dataChanged = mutations.some((mutation) =>
        [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
          node.nodeType === 1 && (node.matches?.('tr[data-report-id]') || node.querySelector?.('tr[data-report-id]'))
        )
      );
      if (!dataChanged) return;
      syncBranchChoices();
      queueApply();
    });
    rowObserver.observe(body, { childList: true });
  }

  function initialize() {
    installStyles();
    wrapRenderer();
    ensureControls();
    observeRows();
    queueApply();
    setTimeout(() => { wrapRenderer(); ensureControls(); observeRows(); queueApply(); }, 250);
    setTimeout(() => { wrapRenderer(); ensureControls(); observeRows(); queueApply(); }, 1100);
  }

  document.addEventListener('ksc:reporting-period-loaded', () => {
    branchSignature = '';
    syncBranchChoices();
    queueApply();
  });
  document.addEventListener('ksc:permissions-refreshed', queueApply);
  document.addEventListener('ksc:branch-submission-filtered', () => {
    const wrap = document.querySelector('.table-card.period-scroll-enabled .table-wrap');
    if (wrap) wrap.scrollTop = 0;
  });
  window.addEventListener('pageshow', queueApply);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();