'use strict';

(function installModuleViewGuard() {
  if (window.__KSC_MODULE_VIEW_GUARD_V1__) return;
  window.__KSC_MODULE_VIEW_GUARD_V1__ = true;

  const VIEW_SECTIONS = Object.freeze({
    dashboard: new Set(['dashboard', 'reports', 'summary']),
    entry: new Set(['entry']),
    checker: new Set(['checker', 'reports']),
    reports: new Set(['reports']),
    summary: new Set(['summary', 'reports']),
    audit: new Set(['audit']),
    administration: new Set(['administration'])
  });

  let syncing = false;
  let framePending = false;

  function installModuleStyles() {
    if (document.getElementById('kscModuleViewGuardStyles')) return;
    const style = document.createElement('style');
    style.id = 'kscModuleViewGuardStyles';
    style.textContent = `
      body:not([data-module="dashboard"]) #dashboardAnalytics{display:none!important}
      body[data-module="entry"] .toolbar{display:none!important}
      body[data-module="entry"] .workspace{margin-top:0!important}
    `;
    document.head.appendChild(style);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function activeView() {
    const active = document.querySelector('.nav-item.active[data-view]:not(.hidden):not([hidden])');
    const fromNavigation = normalize(active?.dataset.view);
    if (VIEW_SECTIONS[fromNavigation]) return fromNavigation;

    const fromBody = normalize(document.body?.dataset.module);
    if (VIEW_SECTIONS[fromBody]) return fromBody;

    try {
      const fromUrl = normalize(new URL(window.location.href).searchParams.get('module'));
      if (VIEW_SECTIONS[fromUrl]) return fromUrl;
    } catch (_) {
      // Continue to the first visible module.
    }

    return normalize(document.querySelector('.nav-item[data-view]:not(.hidden):not([hidden])')?.dataset.view);
  }

  function permissionAllowed(element) {
    const permissionValue = element?.dataset.permission;
    if (!permissionValue) return true;

    try {
      if (typeof hasAnyPermission === 'function') return Boolean(hasAnyPermission(permissionValue));
    } catch (_) {
      // Fall through to individual permission checks.
    }

    const keys = String(permissionValue)
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);

    try {
      if (typeof hasPermission === 'function') return keys.some((key) => hasPermission(key));
    } catch (_) {
      return false;
    }

    return false;
  }

  function setViewVisibility(section, visible) {
    if (!section) return;
    const permissionHidden = section.hidden
      || section.classList.contains('hidden')
      || section.dataset.kscAuthzHidden === 'true'
      || section.dataset.kscPermissionHidden === 'true';
    const shouldShow = visible && !permissionHidden;

    if (shouldShow) {
      if (section.classList.contains('view-hidden')) section.classList.remove('view-hidden');
      section.removeAttribute('aria-hidden-module');
    } else {
      if (!section.classList.contains('view-hidden')) section.classList.add('view-hidden');
      section.setAttribute('aria-hidden-module', 'true');
    }
  }

  function syncModuleSections() {
    framePending = false;
    if (syncing) return;

    const view = activeView();
    const allowedSections = VIEW_SECTIONS[view];
    if (!allowedSections) return;

    syncing = true;
    try {
      if (document.body.dataset.module !== view) document.body.dataset.module = view;

      document.querySelectorAll('[data-section]').forEach((section) => {
        const sectionName = normalize(section.dataset.section);
        const belongsToView = allowedSections.has(sectionName);
        setViewVisibility(section, belongsToView && permissionAllowed(section));
      });
    } finally {
      syncing = false;
    }
  }

  function queueSync() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(syncModuleSections);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.nav-item[data-view]')) window.setTimeout(queueSync, 0);
  }, true);

  window.addEventListener('popstate', queueSync);
  window.addEventListener('pageshow', queueSync);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) queueSync();
  });
  document.addEventListener('ksc:permissions-refreshed', queueSync);

  const observer = new MutationObserver((mutations) => {
    if (syncing) return;
    if (mutations.some((mutation) => {
      if (mutation.type === 'childList') {
        return [...mutation.addedNodes].some((node) => node.nodeType === 1
          && (node.matches?.('[data-section],.nav-item[data-view]')
            || node.querySelector?.('[data-section],.nav-item[data-view]')));
      }
      return mutation.type === 'attributes';
    })) queueSync();
  });

  function initialize() {
    installModuleStyles();
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'data-section', 'data-view', 'data-permission']
    });
    queueSync();
    window.setTimeout(queueSync, 100);
    window.setTimeout(queueSync, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();