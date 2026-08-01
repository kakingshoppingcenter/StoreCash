'use strict';

(function loadDynamicModuleGuards() {
  const guards = [
    {
      selector: 'script[data-ksc-module-view-guard]',
      source: './module-view-guard.js?v=20260801-1510',
      attribute: 'kscModuleViewGuard'
    },
    {
      selector: 'script[data-ksc-dashboard-analytics-guard]',
      source: './dashboard-analytics-guard.js?v=20260801-1510',
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