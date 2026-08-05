'use strict';

(function installBranchSubmissionFilters() {
  if (window.__KSC_BRANCH_SUBMISSION_FILTERS_V1__) return;
  window.__KSC_BRANCH_SUBMISSION_FILTERS_V1__ = true;

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
        .table-card .table-controls.branch-report-filter-controls{
          width:100%!important;
        }
      }

      @media(max-width:760px){
        html body .table-card .table-controls.branch-report-filter-controls{
          width:100%!important;
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:8px!important;
        }
        html body .branch-report-filter-controls .branch-filter-search-field{
          grid-column:1/-1!important;
        }
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
        html body .table-card .table-controls.branch-report-filter-controls{
          grid-template-columns:1fr!important;
        }
        html body .branch-report-filter-controls .branch-filter-search-field{
          grid-column:1!important;
        }
      }
    `;
    document.body.appendChild(style);
  }

  function currentReports() {
    try {
      return Array.isArray(reports) ? reports : [];
    } catch (_) {
      return [];
    }
  }

  function userStorageKey() {
    let userId = 'anonymous';
    try {
      userId = session?.user?.id || 'anonymous';
    } catch (_) {
      // Anonymous fallback keeps this presentation feature operational.
    }
    return `ksc:branch-submission-filters:${userId}`;
  }

  function createField(className, labelText, control) {
    const label = document.createElement('label');
    label.className = `branch-filter-field ${className}`;
    const caption = document.createElement('span');
    caption.textContent = labelText;
    label.append(caption, control);
    return label;
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
      const searchField = createField('branch-filter-search-field', 'Search', search);
      controls.prepend(searchField);
    }

    let branchSelect = document.getElementById('reportBranchFilter');
    if (!branchSelect) {
      branchSelect = document.createElement('select');
      branchSelect.id = 'reportBranchFilter';
      branchSelect.setAttribute('aria-label', 'Filter submissions by branch');
      branchSelect.innerHTML = '<option value="">All Branches</option>';
      controls.appendChild(createField('branch-filter-branch-field', 'Branch', branchSelect));
      branchSelect.addEventListener('change', applyFilters);
    }

    let statusSelect = document.getElementById('reportStatusFilter');
    if (!statusSelect) {
      statusSelect = document.createElement('select');
      statusSelect.id = 'reportStatusFilter';
      statusSelect.setAttribute('aria-label', 'Filter submissions by status');
      statusSelect.innerHTML = STATUS_OPTIONS
        .map(([value, label]) => `<option value="${value}">${label}</option>`)
        .join('');
      controls.appendChild(createField('branch-filter-status-field', 'Status', statusSelect));
      statusSelect.addEventListener('change', applyFilters);
    }

    if (!controlsReady) {
      search.addEventListener('input', () => window.setTimeout(queueApply, 0));
      controlsReady = true;
    }

    updateBranchOptions();
    restoreFilters();
    return true;
  }

  function updateBranchOptions() {
    const select = document.getElementById('reportBranchFilter');
    if (!select) return;

    const previous = select.value;
    const unique = new Map();
    currentReports().forEach((report) => {
      const id = String(report?.branch_id || '').trim();
      if (!id) return;
      const name = String(report?.branches?.name || report?.branches?.code || 'Unknown Branch').trim();
      if (!unique.has(id)) unique.set(id, name);
    });

    const options = [...unique.entries()].sort((left, right) => left[1].localeCompare(right[1], 'en', { sensitivity: 'base' }));
    select.innerHTML = '<option value="">All Branches</option>' + options
      .map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`)
      .join('');

    select.value = options.some(([id]) => id === previous) ? previous : '';
  }

  function restoreFilters() {
    if (restored) return;
    restored = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem(userStorageKey()) || '{}');
      const branch = document.getElementById('reportBranchFilter');
      const status = document.getElementById('reportStatusFilter');
      if (branch && [...branch.options].some((option) => option.value === saved.branch)) branch.value = saved.branch || '';
      if (status && [...status.options].some((option) => option.value === saved.status)) status.value = saved.status || '';
    } catch (_) {
      // Invalid or unavailable local storage should not block filtering.
    }
  }

  function saveFilters() {
    try {
      window.localStorage.setItem(userStorageKey(), JSON.stringify({
        branch: document.getElementById('reportBranchFilter')?.value || '',
        status: document.getElementById('reportStatusFilter')?.value || ''
      }));
    } catch (_) {
      // Filtering remains available when storage is unavailable.
    }
  }

  function removeFilterEmptyRow() {
    document.querySelector('#reportRows .branch-filter-empty')?.remove();
  }

  function addFilterEmptyRow() {
    const body = document.getElementById('reportRows');
    if (!body || body.querySelector('.branch-filter-empty')) return;
    const row = document.createElement('tr');
    row.className = 'branch-filter-empty';
    row.innerHTML = '<td colspan="8" class="empty-state">No submissions match the selected branch and status.</td>';
    body.appendChild(row);
  }

  function applyFilters() {
    framePending = false;
    if (!ensureControls()) return;

    const selectedBranch = document.getElementById('reportBranchFilter')?.value || '';
    const selectedStatus = document.getElementById('reportStatusFilter')?.value || '';
    const reportsById = new Map(currentReports().map((report) => [String(report.id), report]));
    const rows = [...document.querySelectorAll('#reportRows tr[data-report-id]')];
    let visible = 0;

    rows.forEach((row) => {
      const report = reportsById.get(String(row.dataset.reportId));
      const matchesBranch = !selectedBranch || String(report?.branch_id || '') === selectedBranch;
      const matchesStatus = !selectedStatus || String(report?.status || '') === selectedStatus;
      const show = Boolean(report && matchesBranch && matchesStatus);

      row.classList.toggle('branch-filter-hidden', !show);
      row.hidden = !show;
      if (!show) row.style.setProperty('display', 'none', 'important');
      else row.style.removeProperty('display');
      if (show) visible += 1;
    });

    removeFilterEmptyRow();
    if (rows.length > 0 && visible === 0) addFilterEmptyRow();
    saveFilters();
    document.dispatchEvent(new CustomEvent('ksc:branch-submission-filtered', {
      detail: { visible, total: rows.length, branch: selectedBranch, status: selectedStatus }
    }));
  }

  function queueApply() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(applyFilters);
  }

  function wrapRenderer() {
    try {
      if (typeof renderReports !== 'function' || renderReports.__kscBranchStatusFilters) return;
      const original = renderReports;
      const wrapped = function renderReportsWithBranchStatusFilters() {
        original();
        ensureControls();
        updateBranchOptions();
        queueApply();
      };
      wrapped.__kscBranchStatusFilters = true;
      wrapped.__kscBaseRenderReports = original;
      renderReports = wrapped;
    } catch (_) {
      // The DOM observer still applies filters if a restricted browser blocks reassignment.
    }
  }

  function observeRows() {
    const body = document.getElementById('reportRows');
    if (!body || rowObserver) return;
    rowObserver = new MutationObserver(() => {
      updateBranchOptions();
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
    window.setTimeout(() => { wrapRenderer(); ensureControls(); observeRows(); queueApply(); }, 250);
    window.setTimeout(() => { wrapRenderer(); ensureControls(); observeRows(); queueApply(); }, 1100);
  }

  document.addEventListener('ksc:reporting-period-loaded', () => {
    updateBranchOptions();
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