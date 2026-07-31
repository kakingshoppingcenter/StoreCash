'use strict';

(function installPersistentModuleNavigation() {
  const STORAGE_PREFIX = 'ksc:last-module:';
  const RESTORE_INTERVAL_MS = 200;
  const RESTORE_TIMEOUT_MS = 20000;
  let baseSetView = null;
  let activeUserId = null;
  let navigationReady = false;
  let restoreTimer = null;
  let stopTimer = null;

  function currentUserId() {
    try {
      return typeof session !== 'undefined' && session?.user?.id
        ? String(session.user.id)
        : null;
    } catch (_) {
      return null;
    }
  }

  function storageKey(userId = currentUserId()) {
    return userId ? `${STORAGE_PREFIX}${userId}` : null;
  }

  function normalizeView(value) {
    const view = String(value || '').trim().toLowerCase();
    return /^[a-z][a-z0-9_-]{0,40}$/.test(view) ? view : '';
  }

  function visibleNavigation(view) {
    const normalized = normalizeView(view);
    if (!normalized) return null;
    return document.querySelector(`.nav-item[data-view="${normalized}"]:not(.hidden)`);
  }

  function activeNavigationView() {
    const active = document.querySelector('.nav-item.active:not(.hidden)');
    if (active?.dataset.view) return normalizeView(active.dataset.view);
    try {
      return typeof currentView !== 'undefined' ? normalizeView(currentView) : '';
    } catch (_) {
      return '';
    }
  }

  function readSavedView(userId) {
    const key = storageKey(userId);
    if (!key) return '';
    try {
      return normalizeView(window.sessionStorage.getItem(key));
    } catch (_) {
      return '';
    }
  }

  function saveView(view, userId = currentUserId()) {
    const key = storageKey(userId);
    const normalized = normalizeView(view);
    if (!key || !normalized || !visibleNavigation(normalized)) return;
    try {
      window.sessionStorage.setItem(key, normalized);
    } catch (_) {
      // Navigation continues normally when browser storage is unavailable.
    }
  }

  function syncUserState() {
    const userId = currentUserId();
    if (userId === activeUserId) return userId;
    activeUserId = userId;
    navigationReady = false;
    return userId;
  }

  function installSetViewWrapper() {
    if (typeof window.setView !== 'function') return false;
    if (window.setView.__kscPersistentNavigation) return true;

    baseSetView = window.setView;
    const persistentSetView = function persistentSetView(view) {
      const userId = syncUserState();
      baseSetView(view);
      if (!userId) return;
      if (!navigationReady) {
        window.setTimeout(restoreSavedModule, 0);
        return;
      }
      saveView(activeNavigationView(), userId);
    };
    persistentSetView.__kscPersistentNavigation = true;
    persistentSetView.__kscBaseSetView = baseSetView;
    window.setView = persistentSetView;
    return true;
  }

  function restoreSavedModule() {
    if (!installSetViewWrapper()) return false;

    const userId = syncUserState();
    if (!userId || typeof profile === 'undefined' || !profile) return false;

    const availableNavigation = document.querySelector('.nav-item:not(.hidden)');
    if (!availableNavigation) return false;

    const savedView = readSavedView(userId);
    const target = visibleNavigation(savedView);
    if (target) {
      baseSetView(target.dataset.view);
      navigationReady = true;
      saveView(target.dataset.view, userId);
      return true;
    }

    const current = activeNavigationView();
    const fallback = visibleNavigation(current) || availableNavigation;
    baseSetView(fallback.dataset.view);
    navigationReady = true;
    saveView(fallback.dataset.view, userId);
    return true;
  }

  function startRestoreLoop() {
    window.clearInterval(restoreTimer);
    window.clearTimeout(stopTimer);

    restoreSavedModule();
    restoreTimer = window.setInterval(() => {
      const userId = syncUserState();
      if (!userId) return;
      if (!navigationReady) restoreSavedModule();
    }, RESTORE_INTERVAL_MS);

    stopTimer = window.setTimeout(() => {
      window.clearInterval(restoreTimer);
      restoreTimer = null;
    }, RESTORE_TIMEOUT_MS);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.nav-item[data-view]');
    if (!button || button.classList.contains('hidden')) return;
    window.setTimeout(() => {
      const userId = syncUserState();
      const requestedView = normalizeView(button.dataset.view);
      if (!userId || !requestedView || !visibleNavigation(requestedView)) return;
      navigationReady = true;
      saveView(requestedView, userId);
    }, 0);
  }, true);

  window.addEventListener('pageshow', startRestoreLoop);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startRestoreLoop();
  });

  startRestoreLoop();
})();
