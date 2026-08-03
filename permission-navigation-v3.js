'use strict';

(function installPermissionNavigationV3() {
  if (window.__KSC_PERMISSION_NAVIGATION_V3__) return;
  window.__KSC_PERMISSION_NAVIGATION_V3__ = true;

  const ROLE_DEFAULTS = Object.freeze({
    store_user: {
      dashboard_view: true,
      entry_view: true,
      entry_create: true,
      checker_view: false,
      checker_verify: false,
      reports_view: true,
      reports_all_branches: false,
      reports_manage: false,
      summary_view: false,
      audit_view: false,
      export_data: false,
      manage_branches: false,
      manage_users: false
    },
    checker: {
      dashboard_view: true,
      entry_view: false,
      entry_create: false,
      checker_view: true,
      checker_verify: true,
      reports_view: true,
      reports_all_branches: true,
      reports_manage: false,
      summary_view: true,
      audit_view: false,
      export_data: true,
      manage_branches: false,
      manage_users: false
    },
    executive: {
      dashboard_view: true,
      entry_view: false,
      entry_create: false,
      checker_view: false,
      checker_verify: false,
      reports_view: true,
      reports_all_branches: true,
      reports_manage: false,
      summary_view: true,
      audit_view: true,
      export_data: true,
      manage_branches: false,
      manage_users: false
    }
  });

  const VIEW_PERMISSIONS = Object.freeze({
    dashboard: ['dashboard_view'],
    entry: ['entry_view'],
    checker: ['checker_view'],
    reports: ['reports_view'],
    summary: ['summary_view'],
    audit: ['audit_view'],
    administration: ['manage_users', 'manage_branches']
  });

  const ROLE_PREFERRED_VIEWS = Object.freeze({
    store_user: ['entry', 'reports', 'dashboard'],
    checker: ['checker', 'reports', 'summary', 'dashboard'],
    executive: ['summary', 'reports', 'audit', 'dashboard'],
    admin: ['dashboard', 'administration', 'reports']
  });

  const LAST_MODULE_PREFIX = 'ksc:last-module:';
  const SESSION_SELECTION_PREFIX = 'ksc:selected-module:';
  const MODULE_PARAMETER = 'module';
  const PROFILE_REFRESH_MS = 30000;

  let authorizationReady = false;
  let activeUserId = '';
  let refreshInProgress = false;
  let applyQueued = false;
  let lastProfileSignature = '';

  function installPendingStyle() {
    if (document.getElementById('kscPermissionNavigationPendingStyle')) return;
    const style = document.createElement('style');
    style.id = 'kscPermissionNavigationPendingStyle';
    style.textContent = `
      html body[data-ksc-permissions-initial="true"][data-ksc-permissions-ready="false"] #appShell:not(.hidden):not([hidden]){
        visibility:hidden!important;
        pointer-events:none!important;
      }
      html body [data-ksc-authz-hidden="true"]{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function currentDatabase() {
    try { return typeof db !== 'undefined' ? db : null; }
    catch (_) { return null; }
  }

  function currentSession() {
    try { return typeof session !== 'undefined' ? session : null; }
    catch (_) { return null; }
  }

  function currentProfile() {
    try { return typeof profile !== 'undefined' ? profile : null; }
    catch (_) { return null; }
  }

  function normalizePermissions(value) {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (_) {
        return {};
      }
    }
    return {};
  }

  function assignProfile(nextProfile) {
    if (!nextProfile) return false;
    const normalized = {
      ...(currentProfile() || {}),
      ...nextProfile,
      permissions: normalizePermissions(nextProfile.permissions)
    };
    try {
      profile = normalized;
      return true;
    } catch (_) {
      try {
        Object.assign(currentProfile() || {}, normalized);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  function permissionAllowed(key, target = currentProfile()) {
    if (!target || target.active === false) return false;
    if (target.role === 'admin') return true;

    const permissions = normalizePermissions(target.permissions);
    if (Object.prototype.hasOwnProperty.call(permissions, key) && typeof permissions[key] === 'boolean') {
      return permissions[key];
    }
    return Boolean(ROLE_DEFAULTS[target.role]?.[key]);
  }

  function anyPermissionAllowed(value, target = currentProfile()) {
    const keys = String(value || '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    return keys.length > 0 && keys.some((key) => permissionAllowed(key, target));
  }

  function viewAllowed(view, target = currentProfile()) {
    const keys = VIEW_PERMISSIONS[String(view || '').trim().toLowerCase()];
    return Boolean(keys?.some((key) => permissionAllowed(key, target)));
  }

  function hideForAuthorization(element) {
    if (!element) return;
    element.dataset.kscAuthzHidden = 'true';
    element.classList.add('hidden');
    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
    element.style.setProperty('display', 'none', 'important');
    if (element.matches('button,a,[tabindex]')) element.setAttribute('tabindex', '-1');
  }

  function showForAuthorization(element) {
    if (!element || element.dataset.kscAuthzHidden !== 'true') return;
    delete element.dataset.kscAuthzHidden;
    element.classList.remove('hidden');
    element.hidden = false;
    element.setAttribute('aria-hidden', 'false');
    element.style.removeProperty('display');
    if (element.getAttribute('tabindex') === '-1') element.removeAttribute('tabindex');
  }

  function setAuthorizationVisibility(element, allowed) {
    if (allowed) showForAuthorization(element);
    else hideForAuthorization(element);
  }

  function applyPermissionVisibility() {
    const target = currentProfile();
    if (!authorizationReady || !target) return;

    document.querySelectorAll('[data-permission]').forEach((element) => {
      setAuthorizationVisibility(element, anyPermissionAllowed(element.dataset.permission, target));
    });

    document.querySelectorAll('[data-roles]:not([data-permission])').forEach((element) => {
      const roles = String(element.dataset.roles || '')
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean);
      setAuthorizationVisibility(element, roles.includes(target.role));
    });

    document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
      setAuthorizationVisibility(button, viewAllowed(button.dataset.view, target));
    });

    document.querySelectorAll('#mainNav .nav-group-label').forEach((label) => {
      let sibling = label.nextElementSibling;
      let visible = false;
      while (sibling && !sibling.classList.contains('nav-group-label')) {
        if (sibling.matches('.nav-item[data-view]') && !sibling.hidden && !sibling.classList.contains('hidden')) {
          visible = true;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
      setAuthorizationVisibility(label, visible);
    });

    const targetProfile = currentProfile();
    const name = document.getElementById('profileName');
    const role = document.getElementById('profileRole');
    const initials = document.getElementById('profileInitials');
    if (name && targetProfile?.full_name) name.textContent = targetProfile.full_name;
    if (role && targetProfile?.role) {
      const labels = {
        store_user: 'Store User',
        checker: 'Deposit Checker',
        executive: 'Executive Reviewer',
        admin: 'System Administrator'
      };
      role.textContent = labels[targetProfile.role] || targetProfile.role;
    }
    if (initials && targetProfile?.full_name) {
      initials.textContent = String(targetProfile.full_name)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
    }
  }

  function visibleNavigation() {
    return [...document.querySelectorAll('.nav-item[data-view]')]
      .filter((button) => viewAllowed(button.dataset.view) && !button.hidden && !button.classList.contains('hidden'));
  }

  function storageKey(prefix, userId = activeUserId) {
    return userId ? `${prefix}${userId}` : '';
  }

  function readStorage(storage, key) {
    if (!key) return '';
    try { return String(storage.getItem(key) || '').trim().toLowerCase(); }
    catch (_) { return ''; }
  }

  function writeStorage(storage, key, value) {
    if (!key || !value) return;
    try { storage.setItem(key, value); }
    catch (_) { /* Storage is optional. */ }
  }

  function clearStorage(storage, key) {
    if (!key) return;
    try { storage.removeItem(key); }
    catch (_) { /* Storage is optional. */ }
  }

  function requestedUrlView() {
    try {
      return String(new URL(window.location.href).searchParams.get(MODULE_PARAMETER) || '').trim().toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function replaceUrlView(view) {
    if (!view) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(MODULE_PARAMETER) === view) return;
      url.searchParams.set(MODULE_PARAMETER, view);
      window.history.replaceState(
        { ...(window.history.state || {}), kscModule: view },
        '',
        `${url.pathname}${url.search}${url.hash}`
      );
    } catch (_) {
      // URL persistence is optional.
    }
  }

  function activeView() {
    return String(document.querySelector('.nav-item.active[data-view]')?.dataset.view || '').trim().toLowerCase();
  }

  function preferredAllowedView(target = currentProfile()) {
    const preferred = ROLE_PREFERRED_VIEWS[target?.role] || ['dashboard', 'reports'];
    return preferred.find((view) => viewAllowed(view, target)) || visibleNavigation()[0]?.dataset.view || '';
  }

  function selectLandingView() {
    const target = currentProfile();
    if (!authorizationReady || !target || !activeUserId) return '';

    const sessionSelectionKey = storageKey(SESSION_SELECTION_PREFIX);
    const lastModuleKey = storageKey(LAST_MODULE_PREFIX);
    const sessionSelected = readStorage(window.sessionStorage, sessionSelectionKey);
    const requested = requestedUrlView();
    const stored = readStorage(window.localStorage, lastModuleKey)
      || readStorage(window.sessionStorage, lastModuleKey);
    const preferred = preferredAllowedView(target);

    if (sessionSelected && viewAllowed(sessionSelected, target)) return sessionSelected;
    if (requested && requested !== 'dashboard' && viewAllowed(requested, target)) return requested;
    if (stored && stored !== 'dashboard' && viewAllowed(stored, target)) return stored;

    return preferred || (viewAllowed('dashboard', target) ? 'dashboard' : '');
  }

  function activateView(view, persist = true) {
    const normalized = String(view || '').trim().toLowerCase();
    if (!normalized || !viewAllowed(normalized)) return false;

    const button = document.querySelector(`.nav-item[data-view="${normalized}"]:not(.hidden):not([hidden])`);
    if (!button) return false;

    try {
      if (typeof setView === 'function') setView(normalized);
      else if (typeof window.setView === 'function') window.setView(normalized);
      else button.click();
    } catch (_) {
      button.click();
    }

    if (persist) {
      const lastKey = storageKey(LAST_MODULE_PREFIX);
      writeStorage(window.localStorage, lastKey, normalized);
      writeStorage(window.sessionStorage, lastKey, normalized);
      replaceUrlView(normalized);
    }
    return true;
  }

  function ensureAuthorizedLanding() {
    if (!authorizationReady) return;
    applyPermissionVisibility();

    const current = activeView();
    const sessionSelected = readStorage(window.sessionStorage, storageKey(SESSION_SELECTION_PREFIX));
    const target = selectLandingView();
    if (!target) return;

    const currentAllowed = current && viewAllowed(current);
    const deliberateCurrent = sessionSelected && sessionSelected === current && currentAllowed;
    if (deliberateCurrent) {
      replaceUrlView(current);
      return;
    }

    if (!currentAllowed || current !== target) activateView(target, true);
  }

  function queueApply() {
    if (applyQueued) return;
    applyQueued = true;
    window.requestAnimationFrame(() => {
      applyQueued = false;
      ensureAuthorizedLanding();
    });
  }

  function profileSignature(value) {
    if (!value) return '';
    return JSON.stringify({
      id: value.id,
      email: value.email || '',
      full_name: value.full_name || '',
      role: value.role,
      branch_id: value.branch_id,
      active: value.active,
      permissions: normalizePermissions(value.permissions)
    });
  }

  function beginInitialAuthorization(initialAuthorization) {
    if (!initialAuthorization) return;
    document.body.dataset.kscPermissionsInitial = 'true';
    document.body.dataset.kscPermissionsReady = 'false';
  }

  function finishAuthorization() {
    document.body.dataset.kscPermissionsReady = 'true';
    delete document.body.dataset.kscPermissionsInitial;
  }

  async function refreshOwnProfile(force = false) {
    if (refreshInProgress) return false;
    const database = currentDatabase();
    const activeSession = currentSession();
    const userId = activeSession?.user?.id;
    if (!database || !userId) return false;

    if (!force && activeUserId === String(userId) && authorizationReady) return true;

    const initialAuthorization = !authorizationReady || activeUserId !== String(userId);
    const before = lastProfileSignature || profileSignature(currentProfile());
    refreshInProgress = true;
    beginInitialAuthorization(initialAuthorization);

    try {
      let result = await database
        .from('profiles')
        .select('id,email,full_name,role,branch_id,active,permissions')
        .eq('id', userId)
        .maybeSingle();

      if (result.error && /column .*?(email|permissions).*?does not exist|could not find.*?(email|permissions).*?column|schema cache/i.test(result.error.message || '')) {
        result = await database
          .from('profiles')
          .select('id,full_name,role,branch_id,active')
          .eq('id', userId)
          .maybeSingle();
        if (result.data) result.data.permissions = {};
      }

      if (result.error) throw result.error;
      if (!result.data) throw new Error('No active system profile is assigned to this account.');
      if (result.data.active === false) throw new Error('This system account is inactive.');

      activeUserId = String(userId);
      assignProfile(result.data);
      authorizationReady = true;
      const after = profileSignature(currentProfile());
      const changed = initialAuthorization || Boolean(after && after !== before);
      lastProfileSignature = after;
      finishAuthorization();
      if (changed) queueApply();
      return true;
    } catch (error) {
      console.error('Unable to load the signed-in permission profile:', error);
      const fallback = currentProfile();
      if (fallback?.id === userId && fallback.active !== false) {
        activeUserId = String(userId);
        authorizationReady = true;
        lastProfileSignature = profileSignature(fallback);
        finishAuthorization();
        if (initialAuthorization) queueApply();
        return true;
      }
      authorizationReady = false;
      document.body.dataset.kscPermissionsInitial = 'true';
      document.body.dataset.kscPermissionsReady = 'false';
      return false;
    } finally {
      refreshInProgress = false;
    }
  }

  async function bootstrap() {
    installPendingStyle();

    const started = Date.now();
    while (Date.now() - started < 12000) {
      const activeSession = currentSession();
      if (currentDatabase() && activeSession?.user?.id) {
        await refreshOwnProfile(true);
        return;
      }
      if (currentDatabase() && !activeSession && Date.now() - started > 1800) {
        finishAuthorization();
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    }
    finishAuthorization();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.nav-item[data-view]');
    if (!button) return;

    const view = String(button.dataset.view || '').trim().toLowerCase();
    if (!authorizationReady || !viewAllowed(view)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      queueApply();
      return;
    }

    const sessionKey = storageKey(SESSION_SELECTION_PREFIX);
    const lastKey = storageKey(LAST_MODULE_PREFIX);
    writeStorage(window.sessionStorage, sessionKey, view);
    writeStorage(window.sessionStorage, lastKey, view);
    writeStorage(window.localStorage, lastKey, view);
    replaceUrlView(view);
  }, true);

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearStorage(window.sessionStorage, storageKey(SESSION_SELECTION_PREFIX));
    authorizationReady = false;
    activeUserId = '';
    lastProfileSignature = '';
    document.body.dataset.kscPermissionsInitial = 'true';
    document.body.dataset.kscPermissionsReady = 'false';
  }, true);

  const observer = new MutationObserver((mutations) => {
    if (!authorizationReady) return;
    if (mutations.some((mutation) => mutation.type === 'childList')) queueApply();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true
  });

  window.addEventListener('pageshow', () => refreshOwnProfile(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshOwnProfile(true);
  });

  window.setInterval(() => {
    refreshOwnProfile(true).catch((error) => console.error('Silent permission refresh failed:', error));
  }, PROFILE_REFRESH_MS);

  bootstrap();
})();
