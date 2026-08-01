'use strict';

(function loadAuthenticationSecurityGuard() {
  if (!document.getElementById('kscImmediateAuthVisibility')) {
    const style = document.createElement('style');
    style.id = 'kscImmediateAuthVisibility';
    style.textContent = 'html body .hidden,html body .view-hidden{display:none!important}html body #appShell.hidden,html body #appShell[hidden],html body #appShell[aria-hidden="true"]{display:none!important;visibility:hidden!important;pointer-events:none!important}';
    document.head.appendChild(style);
  }

  if (document.querySelector('script[data-ksc-auth-security]')) return;
  const script = document.createElement('script');
  script.src = './auth-security.js?v=20260801-0915';
  script.dataset.kscAuthSecurity = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function loadSignedOutDomCleanup() {
  if (document.querySelector('script[data-ksc-auth-cleanup]')) return;
  const script = document.createElement('script');
  script.src = './auth-security-cleanup.js?v=20260801-0915';
  script.dataset.kscAuthCleanup = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function installPersistentModuleNavigation() {
  if (window.__KSC_MODULE_NAVIGATION_V2__) return;
  window.__KSC_MODULE_NAVIGATION_V2__ = true;

  const VALID_VIEWS = new Set([
    'dashboard',
    'entry',
    'checker',
    'reports',
    'summary',
    'audit',
    'administration'
  ]);
  const STORAGE_PREFIX = 'ksc:last-module:';
  const MODULE_PARAMETER = 'module';
  let activeUserId = null;
  let navigationReady = false;
  let restoreQueued = false;

  function normalizeView(value) {
    const view = String(value || '').trim().toLowerCase();
    return VALID_VIEWS.has(view) ? view : '';
  }

  function currentUserId() {
    try {
      return typeof session !== 'undefined' && session?.user?.id
        ? String(session.user.id)
        : null;
    } catch (_) {
      return null;
    }
  }

  function currentProfileReady() {
    try {
      return typeof profile !== 'undefined' && Boolean(profile);
    } catch (_) {
      return false;
    }
  }

  function storageKey(userId = currentUserId()) {
    return userId ? `${STORAGE_PREFIX}${userId}` : null;
  }

  function visibleNavigation(view) {
    const normalized = normalizeView(view);
    if (!normalized) return null;
    return document.querySelector(`.nav-item[data-view="${normalized}"]:not(.hidden):not([hidden])`);
  }

  function firstVisibleNavigation() {
    return document.querySelector('.nav-item[data-view]:not(.hidden):not([hidden])');
  }

  function activeNavigationView() {
    const active = document.querySelector('.nav-item.active[data-view]:not(.hidden):not([hidden])');
    return normalizeView(active?.dataset.view);
  }

  function readUrlView() {
    try {
      return normalizeView(new URL(window.location.href).searchParams.get(MODULE_PARAMETER));
    } catch (_) {
      return '';
    }
  }

  function writeUrlView(view) {
    const normalized = normalizeView(view);
    if (!normalized) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(MODULE_PARAMETER) === normalized) return;
      url.searchParams.set(MODULE_PARAMETER, normalized);
      window.history.replaceState(
        { ...(window.history.state || {}), kscModule: normalized },
        '',
        `${url.pathname}${url.search}${url.hash}`
      );
    } catch (_) {
      // The module is still retained in browser storage when URL updates are blocked.
    }
  }

  function readStoredView(userId) {
    const key = storageKey(userId);
    if (!key) return '';
    try {
      return normalizeView(
        window.localStorage.getItem(key)
        || window.sessionStorage.getItem(key)
      );
    } catch (_) {
      return '';
    }
  }

  function persistView(view, userId = currentUserId()) {
    const normalized = normalizeView(view);
    if (!normalized || !visibleNavigation(normalized)) return false;

    const key = storageKey(userId);
    if (key) {
      try {
        window.localStorage.setItem(key, normalized);
        window.sessionStorage.setItem(key, normalized);
      } catch (_) {
        // URL persistence remains available when browser storage is unavailable.
      }
    }

    writeUrlView(normalized);
    return true;
  }

  function getSetView() {
    try {
      if (typeof setView === 'function') return setView;
    } catch (_) {
      // Fall through to the window property.
    }
    return typeof window.setView === 'function' ? window.setView : null;
  }

  function replaceSetView(handler) {
    let replaced = false;
    try {
      setView = handler;
      replaced = true;
    } catch (_) {
      // Some browser contexts expose only the window property.
    }
    try {
      window.setView = handler;
      replaced = true;
    } catch (_) {
      // No-op.
    }
    return replaced;
  }

  function syncUserState() {
    const userId = currentUserId();
    if (userId !== activeUserId) {
      activeUserId = userId;
      navigationReady = false;
    }
    return userId;
  }

  function queueRestore() {
    if (restoreQueued) return;
    restoreQueued = true;
    window.setTimeout(() => {
      restoreQueued = false;
      restoreModule();
    }, 0);
  }

  function installSetViewWrapper() {
    const current = getSetView();
    if (!current) return false;
    if (current.__kscPersistentModuleNavigationV2) return true;

    const baseSetView = current;
    const wrappedSetView = function persistentModuleSetView(view) {
      baseSetView(view);
      const userId = syncUserState();
      if (!userId || !navigationReady) {
        queueRestore();
        return;
      }
      persistView(activeNavigationView(), userId);
    };

    wrappedSetView.__kscPersistentModuleNavigationV2 = true;
    wrappedSetView.__kscBaseSetView = baseSetView;
    return replaceSetView(wrappedSetView);
  }

  function requestedView(userId) {
    return readUrlView() || readStoredView(userId);
  }

  function restoreModule() {
    if (!installSetViewWrapper()) return false;

    const userId = syncUserState();
    if (!userId || !currentProfileReady()) return false;

    const firstAvailable = firstVisibleNavigation();
    if (!firstAvailable) return false;

    const requested = requestedView(userId);
    const target = visibleNavigation(requested)
      || visibleNavigation(activeNavigationView())
      || firstAvailable;

    navigationReady = true;
    const view = normalizeView(target.dataset.view);
    const current = getSetView();
    if (current && view) current(view);
    persistView(view, userId);
    return true;
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.nav-item[data-view]');
    if (!button || button.classList.contains('hidden') || button.hidden) return;

    const userId = syncUserState();
    const view = normalizeView(button.dataset.view);
    if (!userId || !view || !visibleNavigation(view)) return;

    navigationReady = true;
    persistView(view, userId);
  }, true);

  window.addEventListener('popstate', () => {
    const requested = readUrlView();
    const target = visibleNavigation(requested);
    const current = getSetView();
    if (!target || !current) return;
    navigationReady = true;
    current(target.dataset.view);
  });

  window.addEventListener('pageshow', queueRestore);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) queueRestore();
  });

  window.setInterval(() => {
    installSetViewWrapper();
    const userId = syncUserState();
    if (userId && !navigationReady) restoreModule();
  }, 250);

  queueRestore();
})();

(function loadPermissionGuard() {
  if (document.querySelector('script[data-ksc-permission-guard]')) return;
  const script = document.createElement('script');
  script.src = './permission-guard.js?v=20260801-0835';
  script.dataset.kscPermissionGuard = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function loadProfessionalInterface() {
  function loadAnalyticsContrastFix() {
    let link = document.querySelector('link[data-ksc-analytics-contrast]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.dataset.kscAnalyticsContrast = 'true';
      document.head.appendChild(link);
    }
    link.href = './analytics-contrast-fix.css?v=20260801-1345';
  }

  loadAnalyticsContrastFix();

  if (document.querySelector('script[data-ksc-professional-ui]')) return;
  const script = document.createElement('script');
  script.src = './professional-ui.js?v=20260801-0835';
  script.dataset.kscProfessionalUi = 'true';
  script.async = false;
  script.addEventListener('load', loadAnalyticsContrastFix, { once: true });
  document.body.appendChild(script);
})();

(function loadUnifiedResponsiveSystem() {
  if (document.querySelector('script[data-ksc-responsive-system-v3]')) return;
  const script = document.createElement('script');
  script.src = './responsive-system-v3.js?v=20260801-1123';
  script.dataset.kscResponsiveSystemV3 = 'true';
  script.async = false;
  document.body.appendChild(script);
})();