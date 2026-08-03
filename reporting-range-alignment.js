'use strict';

(function alignReportingRangeControls() {
  if (window.__KSC_REPORTING_RANGE_ALIGNMENT_V1__) return;
  window.__KSC_REPORTING_RANGE_ALIGNMENT_V1__ = true;

  function installStyles() {
    if (document.getElementById('kscReportingRangeAlignmentStyles')) return;

    const style = document.createElement('style');
    style.id = 'kscReportingRangeAlignmentStyles';
    style.textContent = `
      html body .toolbar.reporting-range-toolbar{
        display:grid!important;
        width:100%!important;
        min-height:94px!important;
        padding:16px 18px!important;
        align-items:end!important;
        justify-content:stretch!important;
        gap:12px 14px!important;
      }
      html body .toolbar.reporting-range-toolbar::before{
        display:none!important;
        content:none!important;
      }
      html body .toolbar.reporting-range-toolbar[data-report-mode="day"],
      html body .toolbar.reporting-range-toolbar[data-report-mode="week"]{
        grid-template-columns:minmax(180px,1fr) minmax(145px,160px) minmax(175px,190px) max-content minmax(210px,1fr)!important;
      }
      html body .toolbar.reporting-range-toolbar[data-report-mode="range"]{
        grid-template-columns:minmax(170px,.9fr) minmax(140px,155px) minmax(165px,180px) minmax(165px,180px) max-content minmax(210px,1fr)!important;
      }
      html body .toolbar.reporting-range-toolbar .reporting-range-heading{
        grid-column:1;
        align-self:center!important;
        display:grid!important;
        gap:4px!important;
        margin:0!important;
        padding:0 8px 0 0!important;
      }
      html body .toolbar.reporting-range-toolbar .reporting-range-heading strong{
        color:#34465f!important;
        font-size:10px!important;
        font-weight:850!important;
        line-height:1.25!important;
        letter-spacing:.07em!important;
        text-transform:uppercase!important;
      }
      html body .toolbar.reporting-range-toolbar .reporting-range-heading small{
        color:#7a899d!important;
        font-size:9px!important;
        font-weight:550!important;
        line-height:1.4!important;
      }
      html body .toolbar.reporting-range-toolbar label{
        width:100%!important;
        max-width:none!important;
        min-width:0!important;
        margin:0!important;
        align-self:end!important;
        display:grid!important;
        gap:7px!important;
      }
      html body .toolbar.reporting-range-toolbar .reporting-mode-field{grid-column:2}
      html body .toolbar.reporting-range-toolbar[data-report-mode="day"] .reporting-anchor-field,
      html body .toolbar.reporting-range-toolbar[data-report-mode="week"] .reporting-anchor-field{grid-column:3}
      html body .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-from-field{grid-column:3}
      html body .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-to-field{grid-column:4}
      html body .toolbar.reporting-range-toolbar input,
      html body .toolbar.reporting-range-toolbar select{
        width:100%!important;
        min-height:44px!important;
        height:44px!important;
        margin:0!important;
        padding:9px 12px!important;
        line-height:1.2!important;
      }
      html body .toolbar.reporting-range-toolbar .reporting-range-actions{
        align-self:end!important;
        justify-self:start!important;
        display:flex!important;
        align-items:stretch!important;
        gap:8px!important;
        min-height:44px!important;
        margin:0!important;
      }
      html body .toolbar.reporting-range-toolbar[data-report-mode="day"] .reporting-range-actions,
      html body .toolbar.reporting-range-toolbar[data-report-mode="week"] .reporting-range-actions{grid-column:4}
      html body .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-range-actions{grid-column:5}
      html body .toolbar.reporting-range-toolbar .reporting-range-actions .btn{
        min-width:64px!important;
        min-height:44px!important;
        height:44px!important;
        margin:0!important;
        padding:0 16px!important;
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
      }
      html body .toolbar.reporting-range-toolbar .reporting-range-summary{
        align-self:end!important;
        justify-self:stretch!important;
        display:grid!important;
        gap:7px!important;
        min-width:0!important;
        margin:0!important;
        text-align:left!important;
      }
      html body .toolbar.reporting-range-toolbar[data-report-mode="day"] .reporting-range-summary,
      html body .toolbar.reporting-range-toolbar[data-report-mode="week"] .reporting-range-summary{grid-column:5}
      html body .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-range-summary{grid-column:6}
      html body .toolbar.reporting-range-toolbar .reporting-range-summary-title{
        color:#41526a!important;
        font-size:10px!important;
        font-weight:750!important;
        line-height:1.25!important;
      }
      html body .toolbar.reporting-range-toolbar .reporting-range-summary-value{
        min-height:44px!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:center!important;
        gap:1px!important;
        padding:7px 12px!important;
        border:1px solid #d8e2ee!important;
        border-radius:10px!important;
        background:#f8fafd!important;
        box-shadow:inset 0 1px 2px rgba(16,36,62,.025)!important;
      }
      html body .toolbar.reporting-range-toolbar .reporting-range-summary-value strong{
        display:block!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        color:#26364d!important;
        font-size:11px!important;
        font-weight:780!important;
        line-height:1.25!important;
        white-space:nowrap!important;
      }
      html body .toolbar.reporting-range-toolbar .reporting-range-summary-value span{
        display:block!important;
        margin:0!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        color:#7a899d!important;
        font-size:9px!important;
        line-height:1.25!important;
        white-space:nowrap!important;
      }
      @media(max-width:1250px){
        html body .toolbar.reporting-range-toolbar,
        html body .toolbar.reporting-range-toolbar[data-report-mode="day"],
        html body .toolbar.reporting-range-toolbar[data-report-mode="week"],
        html body .toolbar.reporting-range-toolbar[data-report-mode="range"]{
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
        }
        html body .toolbar.reporting-range-toolbar .reporting-range-heading{
          grid-column:1/-1!important;
          padding-right:0!important;
        }
        html body .toolbar.reporting-range-toolbar .reporting-mode-field,
        html body .toolbar.reporting-range-toolbar .reporting-anchor-field,
        html body .toolbar.reporting-range-toolbar .reporting-from-field,
        html body .toolbar.reporting-range-toolbar .reporting-to-field,
        html body .toolbar.reporting-range-toolbar .reporting-range-actions{
          grid-column:auto!important;
        }
        html body .toolbar.reporting-range-toolbar .reporting-range-summary{
          grid-column:1/-1!important;
        }
      }
      @media(max-width:820px){
        html body .toolbar.reporting-range-toolbar,
        html body .toolbar.reporting-range-toolbar[data-report-mode="day"],
        html body .toolbar.reporting-range-toolbar[data-report-mode="week"],
        html body .toolbar.reporting-range-toolbar[data-report-mode="range"]{
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
        }
        html body .toolbar.reporting-range-toolbar .reporting-range-actions{
          width:100%!important;
        }
        html body .toolbar.reporting-range-toolbar .reporting-range-actions .btn{
          flex:1 1 0!important;
        }
      }
      @media(max-width:520px){
        html body .toolbar.reporting-range-toolbar,
        html body .toolbar.reporting-range-toolbar[data-report-mode="day"],
        html body .toolbar.reporting-range-toolbar[data-report-mode="week"],
        html body .toolbar.reporting-range-toolbar[data-report-mode="range"]{
          grid-template-columns:1fr!important;
          padding:14px!important;
        }
        html body .toolbar.reporting-range-toolbar .reporting-range-heading,
        html body .toolbar.reporting-range-toolbar .reporting-mode-field,
        html body .toolbar.reporting-range-toolbar .reporting-anchor-field,
        html body .toolbar.reporting-range-toolbar .reporting-from-field,
        html body .toolbar.reporting-range-toolbar .reporting-to-field,
        html body .toolbar.reporting-range-toolbar .reporting-range-actions,
        html body .toolbar.reporting-range-toolbar .reporting-range-summary{
          grid-column:1!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureStructure() {
    const toolbar = document.querySelector('.toolbar.reporting-range-toolbar');
    const mode = document.getElementById('reportMode');
    if (!toolbar || !mode) return false;

    const normalizedMode = ['day', 'week', 'range'].includes(mode.value) ? mode.value : 'day';
    toolbar.dataset.reportMode = normalizedMode;
    toolbar.setAttribute('aria-label', 'Reporting period controls');

    let heading = toolbar.querySelector('.reporting-range-heading');
    if (!heading) {
      heading = document.createElement('div');
      heading.className = 'reporting-range-heading';
      heading.innerHTML = '<strong>Report Controls</strong><small>Select the period to review</small>';
      toolbar.prepend(heading);
    }

    const actions = toolbar.querySelector('.reporting-range-actions');
    if (actions) {
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', 'Reporting period actions');
    }

    const summary = toolbar.querySelector('.reporting-range-summary');
    if (summary && !summary.querySelector('.reporting-range-summary-value')) {
      const periodLabel = summary.querySelector('#reportingPeriodLabel');
      const periodHint = summary.querySelector('#reportingPeriodHint');
      const title = document.createElement('span');
      title.className = 'reporting-range-summary-title';
      title.textContent = 'Selected Period';
      const value = document.createElement('div');
      value.className = 'reporting-range-summary-value';
      if (periodLabel) value.appendChild(periodLabel);
      if (periodHint) value.appendChild(periodHint);
      summary.replaceChildren(title, value);
    }

    return true;
  }

  function synchronize() {
    installStyles();
    ensureStructure();
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'reportMode') window.requestAnimationFrame(synchronize);
  }, true);
  document.addEventListener('ksc:reporting-period-loaded', synchronize);
  window.addEventListener('pageshow', synchronize);

  const observer = new MutationObserver((mutations) => {
    const needsSync = mutations.some((mutation) => [...mutation.addedNodes].some((node) =>
      node.nodeType === 1 && (node.matches?.('.reporting-range-toolbar,#reportMode')
        || node.querySelector?.('.reporting-range-toolbar,#reportMode'))));
    if (needsSync) window.requestAnimationFrame(synchronize);
  });

  function initialize() {
    installStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    synchronize();
    window.setTimeout(synchronize, 100);
    window.setTimeout(synchronize, 700);
    window.setTimeout(synchronize, 1600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
