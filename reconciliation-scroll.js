'use strict';

(function installPeriodResultScrolling() {
  if (window.__KSC_PERIOD_RESULT_SCROLL_V2__) return;
  window.__KSC_PERIOD_RESULT_SCROLL_V2__ = true;

  const STYLE_ID = 'kscPeriodResultScrollStyles';
  const observedTargets = new WeakSet();
  let framePending = false;
  let lastPeriodKey = '';

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList')) queueSync();
  });

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars{
        max-height:430px;
        overflow-x:hidden;
        overflow-y:auto;
        overscroll-behavior:contain;
        scrollbar-gutter:stable;
        scroll-behavior:smooth;
        -webkit-overflow-scrolling:touch;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars:focus-visible,
      #appShell .table-card.period-scroll-enabled .table-wrap:focus-visible{
        outline:2px solid rgba(22,119,255,.55);
        outline-offset:3px;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars::-webkit-scrollbar,
      #appShell .table-card.period-scroll-enabled .table-wrap::-webkit-scrollbar{
        width:9px;
        height:9px;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars::-webkit-scrollbar-track,
      #appShell .table-card.period-scroll-enabled .table-wrap::-webkit-scrollbar-track{
        background:#f1f4f8;
        border-radius:999px;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars::-webkit-scrollbar-thumb,
      #appShell .table-card.period-scroll-enabled .table-wrap::-webkit-scrollbar-thumb{
        background:#bdc9d8;
        border:2px solid #f1f4f8;
        border-radius:999px;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars::-webkit-scrollbar-thumb:hover,
      #appShell .table-card.period-scroll-enabled .table-wrap::-webkit-scrollbar-thumb:hover{
        background:#98a8bb;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled .recon-table-head{
        padding-right:19px;
      }

      #appShell .table-card.period-scroll-enabled .table-wrap{
        max-height:450px;
        overflow-x:auto;
        overflow-y:auto;
        overscroll-behavior:contain;
        scrollbar-gutter:stable;
        -webkit-overflow-scrolling:touch;
      }
      #appShell .table-card.period-scroll-enabled .table-wrap table{
        margin:0;
      }
      #appShell .table-card.period-scroll-enabled .table-wrap thead th{
        position:sticky;
        top:0;
        z-index:4;
        background:#f4f7fb!important;
        box-shadow:0 1px 0 #dfe6ef;
      }

      @media(max-width:760px){
        #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars{
          max-height:370px;
        }
        #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled .recon-table-head{
          padding-right:10px;
        }
        #appShell .table-card.period-scroll-enabled .table-wrap{
          max-height:390px;
        }
      }
      @media(max-width:460px){
        #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars{
          max-height:330px;
        }
        #appShell .table-card.period-scroll-enabled .table-wrap{
          max-height:350px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function currentMode() {
    return String(document.getElementById('reportMode')?.value || 'day').trim().toLowerCase();
  }

  function periodKey() {
    const mode = currentMode();
    const anchor = document.getElementById('filterDate')?.value || '';
    const from = document.getElementById('filterFrom')?.value || '';
    const to = document.getElementById('filterTo')?.value || '';
    return `${mode}:${anchor}:${from}:${to}`;
  }

  function observeTarget(node) {
    if (!node || observedTargets.has(node)) return;
    observedTargets.add(node);
    observer.observe(node, { subtree: true, childList: true });
  }

  function observeTargets() {
    observeTarget(document.getElementById('dashboardAnalytics'));
    observeTarget(document.getElementById('reportRows'));
  }

  function configureScrollableRegion(container, enabled, label, periodChanged) {
    if (!container) return;

    if (enabled) {
      container.tabIndex = 0;
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', label);
      if (periodChanged) container.scrollTop = 0;
    } else {
      container.removeAttribute('tabindex');
      container.removeAttribute('role');
      container.removeAttribute('aria-label');
      container.scrollTop = 0;
    }
  }

  function syncReconciliation(mode, periodChanged) {
    const card = document.querySelector('#dashboardAnalytics .compact-reconciliation-card');
    const bars = card?.querySelector('#branchBars');
    if (!card || !bars) return;

    const rowCount = bars.querySelectorAll('.recon-row').length;
    const shouldScroll = (mode === 'week' || mode === 'range') && rowCount > 8;

    card.classList.toggle('period-scroll-enabled', shouldScroll);
    card.dataset.reportingMode = mode;
    configureScrollableRegion(
      bars,
      shouldScroll,
      `Branch reconciliation results: ${rowCount} reports. Scroll vertically to view more.`,
      periodChanged
    );

    const meta = card.querySelector('#branchChartMeta');
    if (meta && mode !== 'day') {
      const value = meta.textContent || '';
      if (/^\d+ branches\b/i.test(value)) {
        meta.textContent = value.replace(/^([\d,]+) branches\b/i, '$1 reports');
      }
    }
  }

  function syncBranchSubmissions(mode, periodChanged) {
    const rows = document.getElementById('reportRows');
    const card = rows?.closest('.table-card[data-section="reports"]');
    const wrap = card?.querySelector('.table-wrap');
    if (!card || !wrap || !rows) return;

    const visibleRows = Array.from(rows.querySelectorAll('tr')).filter((row) => !row.querySelector('.empty-state'));
    const rowCount = visibleRows.length;
    const shouldScroll = (mode === 'week' || mode === 'range') && rowCount > 8;

    card.classList.toggle('period-scroll-enabled', shouldScroll);
    card.dataset.reportingMode = mode;
    configureScrollableRegion(
      wrap,
      shouldScroll,
      `Branch submissions table: ${rowCount} reports. Scroll vertically to view more.`,
      periodChanged
    );
  }

  function syncScrollState() {
    framePending = false;
    installStyles();
    observeTargets();

    const mode = currentMode();
    const nextPeriodKey = periodKey();
    const periodChanged = nextPeriodKey !== lastPeriodKey;

    syncReconciliation(mode, periodChanged);
    syncBranchSubmissions(mode, periodChanged);

    lastPeriodKey = nextPeriodKey;
  }

  function queueSync() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(syncScrollState);
  }

  function initialize() {
    installStyles();
    observeTargets();
    queueSync();
    window.setTimeout(() => { observeTargets(); queueSync(); }, 150);
    window.setTimeout(() => { observeTargets(); queueSync(); }, 900);
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'reportMode') window.setTimeout(queueSync, 0);
  }, true);
  document.addEventListener('input', (event) => {
    if (event.target?.id === 'reportSearch') window.setTimeout(queueSync, 0);
  }, true);
  document.addEventListener('ksc:reporting-period-loaded', () => window.setTimeout(queueSync, 0));
  document.addEventListener('ksc:reconciliation-metadata-ready', queueSync);
  window.addEventListener('pageshow', queueSync);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();