'use strict';

(function loadReportingPeriodController() {
  if (document.querySelector('script[data-ksc-reporting-range]')) return;
  const script = document.createElement('script');
  script.src = './reporting-range.js?v=20260803-1408';
  script.dataset.kscReportingRange = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function loadReportingRangeAlignment() {
  if (document.querySelector('script[data-ksc-reporting-range-alignment]')) return;
  const script = document.createElement('script');
  script.src = './reporting-range-alignment.js?v=20260803-1455';
  script.dataset.kscReportingRangeAlignment = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function loadReportingRangeModeGuard() {
  if (document.querySelector('script[data-ksc-reporting-range-mode-guard]')) return;
  const script = document.createElement('script');
  script.src = './reporting-range-mode-guard.js?v=20260803-1518';
  script.dataset.kscReportingRangeModeGuard = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function loadCompactDashboardLayout() {
  if (document.querySelector('script[data-ksc-reconciliation-scroll-v3]')) return;
  const script = document.createElement('script');
  script.src = './reconciliation-scroll.js?v=20260804-1020';
  script.dataset.kscReconciliationScrollV3 = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function loadMatchedReportRatio() {
  if (document.querySelector('script[data-ksc-matched-report-ratio]')) return;
  const script = document.createElement('script');
  script.src = './matched-report-ratio.js?v=20260804-1008';
  script.dataset.kscMatchedReportRatio = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function loadScopedAutoAccountReconciliation() {
  if (!document.querySelector('script[data-ksc-checker-auto-account]')) {
    const feature = document.createElement('script');
    feature.src = './checker-auto-account.js?v=20260803-1638';
    feature.dataset.kscCheckerAutoAccount = 'true';
    feature.async = false;
    document.body.appendChild(feature);
  }

  if (!document.querySelector('script[data-ksc-dashboard-analytics]')) {
    const analytics = document.createElement('script');
    analytics.src = './dashboard-analytics.js?v=20260803-1638';
    analytics.dataset.kscDashboardAnalytics = 'true';
    analytics.async = false;
    document.body.appendChild(analytics);
  }
})();

(function loadJulySampleDataAdministration() {
  if (!document.querySelector('script[data-ksc-admin-sample-data-direct]')) {
    const direct = document.createElement('script');
    direct.src = './admin-sample-data-direct.js?v=20260804-0902';
    direct.dataset.kscAdminSampleDataDirect = 'true';
    direct.async = false;
    document.body.appendChild(direct);
  }

  if (document.querySelector('script[data-ksc-admin-sample-data]')) return;
  const script = document.createElement('script');
  script.src = './admin-sample-data.js?v=20260804-0902';
  script.dataset.kscAdminSampleData = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function loadDynamicModuleGuards() {
  const guards = [
    {
      selector: 'script[data-ksc-module-view-guard]',
      source: './module-view-guard.js?v=20260801-1510',
      attribute: 'kscModuleViewGuard'
    },
    {
      selector: 'script[data-ksc-dashboard-analytics-guard]',
      source: './dashboard-analytics-guard.js?v=20260803-1238',
      attribute: 'kscDashboardAnalyticsGuard'
    }
  ];

  guards.forEach(({ selector, source, attribute }) => {
    if (document.querySelector(selector)) return;
    const script = document.createElement('script');
    script.src = source;
    script.dataset[attribute] = 'true';
    script.async = false;
    document.body.appendChild(script);
  });
})();

(function installPermissionSessionWatch() {
  if (window.__KSC_PERMISSION_SESSION_WATCH__) return;
  window.__KSC_PERMISSION_SESSION_WATCH__ = true;

  let lastUserId = '';
  let initialized = false;

  function currentUserId() {
    try {
      return typeof session !== 'undefined' && session?.user?.id
        ? String(session.user.id)
        : '';
    } catch (_) {
      return '';
    }
  }

  function inspectSession() {
    const userId = currentUserId();

    if (!initialized) {
      initialized = true;
      lastUserId = userId;
      if (userId) window.dispatchEvent(new Event('pageshow'));
      return;
    }

    if (userId === lastUserId) return;
    lastUserId = userId;

    if (userId) {
      document.body.dataset.kscPermissionsReady = 'false';
      window.dispatchEvent(new Event('pageshow'));
    } else {
      document.body.dataset.kscPermissionsReady = 'true';
    }
  }

  window.setInterval(inspectSession, 250);
  inspectSession();
})();