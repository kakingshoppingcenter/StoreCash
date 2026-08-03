'use strict';

(function enforceReportingRangeModeVisibility() {
  if (window.__KSC_REPORTING_RANGE_MODE_GUARD_V1__) return;
  window.__KSC_REPORTING_RANGE_MODE_GUARD_V1__ = true;

  let framePending = false;

  function synchronize() {
    framePending = false;

    const toolbar = document.querySelector('.toolbar.reporting-range-toolbar');
    const modeControl = document.getElementById('reportMode');
    const anchorField = document.getElementById('filterDate')?.closest('label');
    const fromField = document.getElementById('filterFrom')?.closest('label');
    const toField = document.getElementById('filterTo')?.closest('label');

    if (!toolbar || !modeControl || !anchorField || !fromField || !toField) return false;

    const mode = ['day', 'week', 'range'].includes(modeControl.value)
      ? modeControl.value
      : 'day';

    toolbar.dataset.reportMode = mode;

    const rangeMode = mode === 'range';
    anchorField.hidden = rangeMode;
    fromField.hidden = !rangeMode;
    toField.hidden = !rangeMode;

    anchorField.classList.toggle('reporting-range-hidden', rangeMode);
    fromField.classList.toggle('reporting-range-hidden', !rangeMode);
    toField.classList.toggle('reporting-range-hidden', !rangeMode);

    anchorField.setAttribute('aria-hidden', rangeMode ? 'true' : 'false');
    fromField.setAttribute('aria-hidden', rangeMode ? 'false' : 'true');
    toField.setAttribute('aria-hidden', rangeMode ? 'false' : 'true');

    return true;
  }

  function queueSynchronize() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(synchronize);
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'reportMode') queueSynchronize();
  }, true);

  document.addEventListener('ksc:reporting-period-loaded', queueSynchronize);
  window.addEventListener('pageshow', queueSynchronize);

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        return target?.id === 'reportMode'
          || target?.id === 'filterDate'
          || target?.id === 'filterFrom'
          || target?.id === 'filterTo'
          || target?.classList?.contains('reporting-range-toolbar');
      }

      return [...mutation.addedNodes].some((node) => node.nodeType === 1
        && (node.matches?.('#reportMode,#filterDate,#filterFrom,#filterTo,.reporting-range-toolbar')
          || node.querySelector?.('#reportMode,#filterDate,#filterFrom,#filterTo,.reporting-range-toolbar')));
    });

    if (relevant) queueSynchronize();
  });

  function initialize() {
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'value', 'data-report-mode']
    });

    queueSynchronize();
    window.setTimeout(queueSynchronize, 100);
    window.setTimeout(queueSynchronize, 700);
    window.setTimeout(queueSynchronize, 1600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();