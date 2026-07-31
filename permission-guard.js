'use strict';

(function installPermissionGuard() {
  if (window.__KSC_PERMISSION_GUARD_V1__) return;
  window.__KSC_PERMISSION_GUARD_V1__ = true;

  const ROLE_DEFAULTS = {
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
  };

  const VIEW_PERMISSIONS = {
    dashboard: ['dashboard_view'],
    entry: ['entry_view'],
    checker: ['checker_view'],
    reports: ['reports_view'],
    summary: ['summary_view'],
    audit: ['audit_view'],
    administration: ['manage_users', 'manage_branches']
  };

  let refreshingProfile = false;
  let lastProfileRefresh = 0;
  let enforcing = false;

  function currentProfile() {
    try {
      return typeof profile !== 'undefined' ? profile : null;
    } catch (_) {
      return null;
    }
  }

  function currentSession() {
    try {
      return typeof session !== 'undefined' ? session : null;
    } catch (_) {
      return null;
    }
  }

  function currentDatabase() {
    try {
      return typeof db !== 'undefined' ? db : null;
    } catch (_) {
      return null;
    }
  }

  function normalizedPermissions(target) {
    const value = target?.permissions;
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

  function permissionAllowed(key, target = currentProfile()) {
    if (!target || target.active === false) return false;
    if (target.role === 'admin') return true;

    try {
      if (typeof hasPermission === 'function') return Boolean(hasPermission(key, target));
    } catch (_) {
      // Fall back to the same explicit override logic below.
    }

    const custom = normalizedPermissions(target);
    if (Object.prototype.hasOwnProperty.call(custom, key) && typeof custom[key] === 'boolean') {
      return custom[key];
    }
    return Boolean(ROLE_DEFAULTS[target.role]?.[key]);
  }

  function permissionListAllowed(value, target = currentProfile()) {
    const keys = String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return keys.length > 0 && keys.some((key) => permissionAllowed(key, target));
  }

  function viewAllowed(view, target = currentProfile()) {
    const permissions = VIEW_PERMISSIONS[String(view || '')];
    return Boolean(permissions?.some((key) => permissionAllowed(key, target)));
  }

  function hideElement(element) {
    if (!element) return;
    if (!element.classList.contains('hidden')) element.classList.add('hidden');
    if (!element.hidden) element.hidden = true;
    if (element.getAttribute('aria-hidden') !== 'true') element.setAttribute('aria-hidden', 'true');
    if (element.dataset.kscPermissionHidden !== 'true') element.dataset.kscPermissionHidden = 'true';
    if (element.style.getPropertyValue('display') !== 'none' || element.style.getPropertyPriority('display') !== 'important') {
      element.style.setProperty('display', 'none', 'important');
    }
    if (element.matches('button,a,[tabindex]') && element.getAttribute('tabindex') !== '-1') {
      element.setAttribute('tabindex', '-1');
    }
  }

  function showElement(element) {
    if (!element || element.dataset.kscPermissionHidden !== 'true') return;
    element.classList.remove('hidden');
    element.hidden = false;
    element.setAttribute('aria-hidden', 'false');
    delete element.dataset.kscPermissionHidden;
    element.style.removeProperty('display');
    if (element.getAttribute('tabindex') === '-1') element.removeAttribute('tabindex');
  }

  function setProtectedVisibility(element, allowed) {
    if (allowed) showElement(element);
    else hideElement(element);
  }

  function visibleNavigation() {
    return [...document.querySelectorAll('.nav-item[data-view]')]
      .filter((button) => viewAllowed(button.dataset.view) && !button.hidden && !button.classList.contains('hidden'));
  }

  function hideEmptyNavigationGroups() {
    document.querySelectorAll('#mainNav .nav-group-label').forEach((label) => {
      let sibling = label.nextElementSibling;
      let hasVisibleModule = false;
      while (sibling && !sibling.classList.contains('nav-group-label')) {
        if (sibling.matches('.nav-item[data-view]') && !sibling.hidden && !sibling.classList.contains('hidden')) {
          hasVisibleModule = true;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
      setProtectedVisibility(label, hasVisibleModule);
    });
  }

  function replaceUrlModule(view) {
    if (!view) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('module') === view) return;
      url.searchParams.set('module', view);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (_) {
      // URL persistence is optional; permission enforcement remains active.
    }
  }

  function activateFirstAllowedModule() {
    const navigation = visibleNavigation();
    if (!navigation.length) return;

    const active = document.querySelector('.nav-item.active[data-view]');
    let requested = '';
    try {
      requested = new URL(window.location.href).searchParams.get('module') || '';
    } catch (_) {
      requested = '';
    }

    const activeAllowed = active && viewAllowed(active.dataset.view) && !active.hidden && !active.classList.contains('hidden');
    const requestedAllowed = !requested || viewAllowed(requested);
    if (activeAllowed && requestedAllowed) return;

    const first = navigation[0];
    const view = first.dataset.view;
    try {
      if (typeof setView === 'function') setView(view);
      else if (typeof window.setView === 'function') window.setView(view);
      else first.click();
    } catch (_) {
      first.click();
    }
    replaceUrlModule(view);
  }

  function enforcePermissions() {
    if (enforcing) return;
    const target = currentProfile();
    if (!target) return;

    enforcing = true;
    try {
      document.querySelectorAll('[data-permission]').forEach((element) => {
        setProtectedVisibility(element, permissionListAllowed(element.dataset.permission, target));
      });

      document.querySelectorAll('[data-roles]:not([data-permission])').forEach((element) => {
        const roles = String(element.dataset.roles || '').split(',').map((item) => item.trim()).filter(Boolean);
        setProtectedVisibility(element, roles.includes(target.role));
      });

      document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
        setProtectedVisibility(button, viewAllowed(button.dataset.view, target));
      });

      hideEmptyNavigationGroups();
      activateFirstAllowedModule();
    } finally {
      enforcing = false;
    }
  }

  async function refreshOwnProfile(force = false) {
    const activeSession = currentSession();
    const database = currentDatabase();
    if (!activeSession?.user?.id || !database || refreshingProfile) return;
    if (!force && Date.now() - lastProfileRefresh < 30000) return;

    refreshingProfile = true;
    try {
      const result = await database
        .from('profiles')
        .select('id,role,branch_id,active,permissions')
        .eq('id', activeSession.user.id)
        .maybeSingle();

      if (!result.error && result.data) {
        try {
          profile = {
            ...(currentProfile() || {}),
            ...result.data,
            permissions: normalizedPermissions(result.data)
          };
        } catch (_) {
          // The loaded profile remains usable if the global binding cannot be reassigned.
        }
        lastProfileRefresh = Date.now();
      }
    } catch (error) {
      console.error('Permission profile refresh failed:', error);
    } finally {
      refreshingProfile = false;
      enforcePermissions();
    }
  }

  document.addEventListener('click', (event) => {
    const navigation = event.target.closest?.('.nav-item[data-view]');
    if (!navigation || viewAllowed(navigation.dataset.view)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    enforcePermissions();
  }, true);

  const observer = new MutationObserver(() => enforcePermissions());
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true
  });

  window.addEventListener('pageshow', () => refreshOwnProfile(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshOwnProfile(true);
  });

  window.setInterval(enforcePermissions, 1000);
  window.setInterval(() => refreshOwnProfile(false), 30000);
  window.setTimeout(() => refreshOwnProfile(true), 0);
  window.setTimeout(enforcePermissions, 100);
})();
