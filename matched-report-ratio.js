'use strict';

(function installMatchedReportRatio() {
  if (window.__KSC_MATCHED_REPORT_RATIO_V1__) return;
  window.__KSC_MATCHED_REPORT_RATIO_V1__ = true;

  let framePending = false;
  let observer = null;

  function installStyles() {
    if (document.getElementById('kscMatchedReportRatioStyles')) return;

    const style = document.createElement('style');
    style.id = 'kscMatchedReportRatioStyles';
    style.textContent = `
      #dashboardAnalytics #statMatched.analytics-stat-value.matched-report-ratio{
        max-width:100%;
        overflow:visible;
        text-overflow:clip;
        white-space:nowrap;
        font-size:clamp(17px,1.45vw,23px)!important;
        letter-spacing:-.045em!important;
        font-variant-numeric:tabular-nums;
      }
      @media(max-width:520px){
        #dashboardAnalytics #statMatched.analytics-stat-value.matched-report-ratio{
          font-size:16px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function totalReports() {
    try {
      return Array.isArray(reports) ? reports.length : 0;
    } catch (_) {
      return 0;
    }
  }

  function readMatched(value) {
    const match = String(value || '').match(/[\d,]+/);
    return match ? Number(match[0].replace(/,/g, '')) || 0 : 0;
  }

  function updateMatchedDisplay() {
    framePending = false;
    installStyles();

    const value = document.getElementById('statMatched');
    if (!value) return;

    const matched = readMatched(value.textContent);
    const total = totalReports();
    const display = `${matched.toLocaleString('en-PH')} out of ${total.toLocaleString('en-PH')}`;

    value.classList.add('matched-report-ratio');
    value.setAttribute('aria-label', `${matched.toLocaleString('en-PH')} matched reports out of ${total.toLocaleString('en-PH')} submitted reports`);
    if (value.textContent !== display) value.textContent = display;
  }

  function queueUpdate() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateMatchedDisplay);
  }

  function observeAnalytics() {
    const section = document.getElementById('dashboardAnalytics');
    if (!section || observer) return;

    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === 'childList' || mutation.type === 'characterData')) {
        queueUpdate();
      }
    });
    observer.observe(section, { subtree: true, childList: true, characterData: true });
  }

  function initialize() {
    installStyles();
    observeAnalytics();
    queueUpdate();
    window.setTimeout(() => { observeAnalytics(); queueUpdate(); }, 150);
    window.setTimeout(() => { observeAnalytics(); queueUpdate(); }, 900);
  }

  document.addEventListener('ksc:reporting-period-loaded', () => window.setTimeout(queueUpdate, 0));
  document.addEventListener('ksc:reconciliation-metadata-ready', queueUpdate);
  window.addEventListener('pageshow', queueUpdate);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();