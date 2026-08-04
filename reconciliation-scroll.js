'use strict';

(function installReconciliationPeriodScroll() {
  if (window.__KSC_RECONCILIATION_PERIOD_SCROLL_V1__) return;
  window.__KSC_RECONCILIATION_PERIOD_SCROLL_V1__ = true;

  const STYLE_ID = 'kscReconciliationPeriodScrollStyles';
  let framePending = false;
  let lastPeriodKey = '';
  let observer = null;

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
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars:focus-visible{
        outline:2px solid rgba(22,119,255,.55);
        outline-offset:3px;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars::-webkit-scrollbar{
        width:9px;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars::-webkit-scrollbar-track{
        background:#f1f4f8;
        border-radius:999px;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars::-webkit-scrollbar-thumb{
        background:#bdc9d8;
        border:2px solid #f1f4f8;
        border-radius:999px;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars::-webkit-scrollbar-thumb:hover{
        background:#98a8bb;
      }
      #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled .recon-table-head{
        padding-right:19px;
      }
      @media(max-width:760px){
        #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars{
          max-height:370px;
        }
        #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled .recon-table-head{
          padding-right:10px;
        }
      }
      @media(max-width:460px){
        #dashboardAnalytics .compact-reconciliation-card.period-scroll-enabled #branchBars{
          max-height:330px;
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

  function syncScrollState() {
    framePending = false;
    installStyles();

    const card = document.querySelector('#dashboardAnalytics .compact-reconciliation-card');
    const bars = card?.querySelector('#branchBars');
    if (!card || !bars) return;

    const mode = currentMode();
    const rowCount = bars.querySelectorAll('.recon-row').length;
    const shouldScroll = (mode === 'week' || mode === 'range') && rowCount > 8;
    const nextPeriodKey = periodKey();
    const periodChanged = nextPeriodKey !== lastPeriodKey;

    card.classList.toggle('period-scroll-enabled', shouldScroll);
    card.dataset.reportingMode = mode;

    if (shouldScroll) {
      bars.tabIndex = 0;
      bars.setAttribute('role', 'region');
      bars.setAttribute('aria-label', `Branch reconciliation results: ${rowCount} reports. Scroll vertically to view more.`);
      if (periodChanged) bars.scrollTop = 0;
    } else {
      bars.removeAttribute('tabindex');
      bars.removeAttribute('role');
      bars.removeAttribute('aria-label');
      bars.scrollTop = 0;
    }

    lastPeriodKey = nextPeriodKey;

    const meta = card.querySelector('#branchChartMeta');
    if (meta && mode !== 'day') {
      const value = meta.textContent || '';
      if (/^\d+ branches\b/i.test(value)) {
        meta.textContent = value.replace(/^([\d,]+) branches\b/i, '$1 reports');
      }
    }
  }

  function queueSync() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(syncScrollState);
  }

  function observeAnalytics() {
    const section = document.getElementById('dashboardAnalytics');
    if (!section || observer) return;

    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === 'childList')) queueSync();
    });
    observer.observe(section, { subtree: true, childList: true });
  }

  function initialize() {
    installStyles();
    observeAnalytics();
    queueSync();
    window.setTimeout(() => { observeAnalytics(); queueSync(); }, 150);
    window.setTimeout(() => { observeAnalytics(); queueSync(); }, 900);
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'reportMode') window.setTimeout(queueSync, 0);
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