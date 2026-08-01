'use strict';

(function installAuthenticationSecurityGuard() {
  if (window.__KSC_AUTH_SECURITY_V1__) return;
  window.__KSC_AUTH_SECURITY_V1__ = true;

  const AUTH_LOCK_CLASS = 'ksc-auth-locked';
  const AUTHENTICATED_CLASS = 'ksc-authenticated';
  const MODULE_STORAGE_PREFIX = 'ksc:last-module:';
  let authLocked = true;
  let authorizing = false;
  let pendingReveal = false;
  let signingOut = false;
  let sessionCheckRunning = false;

  function byElementId(id) {
    return document.getElementById(id);
  }

  function currentSession() {
    try {
      return typeof session !== 'undefined' ? session : null;
    } catch (_) {
      return null;
    }
  }

  function currentProfile() {
    try {
      return typeof profile !== 'undefined' ? profile : null;
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

  function installSecurityStyles() {
    if (document.getElementById('kscAuthenticationSecurityStyles')) return;
    const style = document.createElement('style');
    style.id = 'kscAuthenticationSecurityStyles';
    style.textContent = `
      html body #appShell.hidden,
      html body #appShell[hidden],
      html body #appShell[aria-hidden="true"],
      html body.${AUTH_LOCK_CLASS} #appShell{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
      html body #authScreen.hidden,
      html body #authScreen[hidden],
      html body #authScreen[aria-hidden="true"],
      html body.${AUTHENTICATED_CLASS} #authScreen{
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
      html body.${AUTH_LOCK_CLASS} #authScreen{
        display:grid!important;
        visibility:visible!important;
        pointer-events:auto!important;
      }
    `;
    document.head.appendChild(style);
  }

  function setText(id, value) {
    const element = byElementId(id);
    if (element) element.textContent = value;
  }

  function setValue(id, value) {
    const element = byElementId(id);
    if (element && 'value' in element) element.value = value;
  }

  function clearElement(id, replacement = '') {
    const element = byElementId(id);
    if (element) element.innerHTML = replacement;
  }

  function clearModuleLocation() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('module')) return;
      url.searchParams.delete('module');
      window.history.replaceState(
        { ...(window.history.state || {}), kscModule: null },
        '',
        `${url.pathname}${url.search}${url.hash}`
      );
    } catch (_) {
      // URL cleanup is supplementary; protected content is already removed.
    }
  }

  function clearModuleStorage(userId) {
    if (!userId) return;
    const key = `${MODULE_STORAGE_PREFIX}${userId}`;
    try { window.localStorage.removeItem(key); } catch (_) { /* no-op */ }
    try { window.sessionStorage.removeItem(key); } catch (_) { /* no-op */ }
  }

  function clearSupabaseBrowserSession() {
    try {
      const projectUrl = String(window.KSC_CONFIG?.supabaseUrl || '');
      const projectRef = new URL(projectUrl).hostname.split('.')[0];
      if (!projectRef) return;
      const prefixes = [`sb-${projectRef}-auth-token`, `sb-${projectRef}-auth-token-code-verifier`];
      [window.localStorage, window.sessionStorage].forEach((storage) => {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index);
          if (key && prefixes.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
        }
      });
    } catch (_) {
      // Supabase signOut remains the primary session-removal mechanism.
    }
  }

  function resetApplicationBindings() {
    try { session = null; } catch (_) { /* no-op */ }
    try { profile = null; } catch (_) { /* no-op */ }
    try { branches = []; } catch (_) { /* no-op */ }
    try { reports = []; } catch (_) { /* no-op */ }
    try { audits = []; } catch (_) { /* no-op */ }
    try { selectedEntryReport = null; } catch (_) { /* no-op */ }
    try { selectedCheckerReport = null; } catch (_) { /* no-op */ }
    try { currentView = 'dashboard'; } catch (_) { /* no-op */ }
    try { adminBranches = []; } catch (_) { /* no-op */ }
    try { adminUsers = []; } catch (_) { /* no-op */ }
    try { selectedAdminUserId = null; } catch (_) { /* no-op */ }
    try { selectedAdminBranchId = null; } catch (_) { /* no-op */ }
    try { loadingCount = 0; } catch (_) { /* no-op */ }
  }

  function clearRenderedProtectedData() {
    const protectedBodies = [
      'reportRows',
      'auditRows',
      'adminBranchRows',
      'adminUserRows'
    ];
    protectedBodies.forEach((id) => clearElement(id));

    clearElement('executiveSummary', '<div class="empty-state">Sign in to view authorized report information.</div>');
    clearElement('checkerReportSelect', '<option value="">Sign in required</option>');
    clearElement('summaryReportSelect', '<option value="">Sign in required</option>');
    clearElement('branch');

    setText('metricReported', '₱0.00');
    setText('metricActual', '₱0.00');
    setText('metricDifference', '₱0.00');
    setText('metricCustomers', '0');
    setText('checkerReportLabel', 'No report selected');
    setText('checkerReported', '₱0.00');
    setText('difference', '₱0.00');
    setText('checkerStatus', 'Select Report');
    setText('entryStatus', 'New Report');
    setText('profileName', 'Authorized User');
    setText('profileRole', 'Signed Out');
    setText('profileInitials', 'KS');
    setText('connectionText', 'Sign in required');

    setValue('actualReceived', '0');
    setValue('reading', '0');
    setValue('checkerRemarks', '');
    setValue('receivedBy', '');
    setValue('customers', '0');
    setValue('storeRemarks', '');
    setValue('reportSearch', '');
    setValue('userFullName', '');
    setValue('userEmail', '');
    setValue('userPassword', '');
    setValue('branchCode', '');
    setValue('branchName', '');
    setValue('loginPassword', '');

    document.querySelectorAll('#paymentFields input').forEach((input) => { input.value = '0'; });

    ['entryForm', 'userAdminForm', 'branchAdminForm'].forEach((id) => {
      const form = byElementId(id);
      if (form && typeof form.reset === 'function') form.reset();
    });

    const overlay = byElementId('loadingOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }

    const toast = byElementId('toast');
    if (toast) {
      toast.textContent = '';
      toast.className = 'toast';
    }
  }

  function enforceLockedShell() {
    const authScreen = byElementId('authScreen');
    const appShell = byElementId('appShell');

    document.body.classList.add(AUTH_LOCK_CLASS);
    document.body.classList.remove(AUTHENTICATED_CLASS);

    if (appShell) {
      appShell.classList.add('hidden');
      appShell.hidden = true;
      appShell.inert = true;
      appShell.setAttribute('aria-hidden', 'true');
      appShell.style.setProperty('display', 'none', 'important');
      appShell.style.setProperty('visibility', 'hidden', 'important');
      appShell.style.setProperty('pointer-events', 'none', 'important');
    }

    if (authScreen) {
      authScreen.classList.remove('hidden');
      authScreen.hidden = false;
      authScreen.inert = false;
      authScreen.setAttribute('aria-hidden', 'false');
      authScreen.style.removeProperty('display');
      authScreen.style.removeProperty('visibility');
      authScreen.style.removeProperty('pointer-events');
    }
  }

  function lockApplication(message = '', clearData = true) {
    const userId = currentSession()?.user?.id || null;
    authLocked = true;
    pendingReveal = false;

    if (clearData) {
      clearModuleStorage(userId);
      resetApplicationBindings();
      clearRenderedProtectedData();
    }

    clearModuleLocation();
    enforceLockedShell();
    if (message) setText('authMessage', message);
    document.title = 'Sign in · Kaking Store Cash';
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }

  function revealAuthorizedApplication() {
    const activeSession = currentSession();
    const activeProfile = currentProfile();
    if (!activeSession?.user?.id || !activeProfile?.id || activeProfile.active === false) {
      lockApplication('Your secure session is not available. Sign in again.', true);
      return false;
    }

    const authScreen = byElementId('authScreen');
    const appShell = byElementId('appShell');
    authLocked = false;

    document.body.classList.remove(AUTH_LOCK_CLASS);
    document.body.classList.add(AUTHENTICATED_CLASS);

    if (authScreen) {
      authScreen.classList.add('hidden');
      authScreen.hidden = true;
      authScreen.inert = true;
      authScreen.setAttribute('aria-hidden', 'true');
      authScreen.style.setProperty('display', 'none', 'important');
    }

    if (appShell) {
      appShell.classList.remove('hidden');
      appShell.hidden = false;
      appShell.inert = false;
      appShell.setAttribute('aria-hidden', 'false');
      appShell.style.removeProperty('display');
      appShell.style.removeProperty('visibility');
      appShell.style.removeProperty('pointer-events');
    }

    setText('authMessage', '');
    return true;
  }

  const baseStartApplication = (() => {
    try { return typeof startApplication === 'function' ? startApplication : null; }
    catch (_) { return null; }
  })();

  function secureShowAuth(message = '') {
    lockApplication(message, true);
  }

  function secureShowApp() {
    if (authorizing) {
      pendingReveal = true;
      return;
    }
    revealAuthorizedApplication();
  }

  async function secureStartApplication(nextSession) {
    if (!nextSession?.user?.id || !baseStartApplication) {
      lockApplication('', true);
      return;
    }

    authorizing = true;
    pendingReveal = false;
    lockApplication('', true);

    try {
      await baseStartApplication(nextSession);
    } finally {
      authorizing = false;
      if (currentSession()?.user?.id && currentProfile()?.id && (pendingReveal || authLocked)) {
        revealAuthorizedApplication();
      } else if (!currentSession()?.user?.id || !currentProfile()?.id) {
        enforceLockedShell();
      }
      pendingReveal = false;
    }
  }

  function replaceGlobalFunction(name, replacement) {
    try {
      if (name === 'showAuth') showAuth = replacement;
      else if (name === 'showApp') showApp = replacement;
      else if (name === 'startApplication') startApplication = replacement;
      else if (name === 'signOut') signOut = replacement;
    } catch (_) {
      // Window assignment below supports contexts without a writable lexical binding.
    }
    try { window[name] = replacement; } catch (_) { /* no-op */ }
  }

  async function performSecureSignOut() {
    if (signingOut) return;
    signingOut = true;
    const database = currentDatabase();
    const previousUserId = currentSession()?.user?.id || null;

    lockApplication('Signing out securely…', true);
    clearModuleStorage(previousUserId);

    try {
      if (database?.auth?.signOut) {
        const result = await database.auth.signOut();
        if (result?.error) throw result.error;
      }
      clearSupabaseBrowserSession();
      lockApplication('You have signed out successfully.', true);
    } catch (error) {
      console.error('Secure sign-out failed:', error);
      try {
        if (database?.auth?.signOut) await database.auth.signOut({ scope: 'local' });
      } catch (_) {
        // Browser session storage is cleared below as a final local safeguard.
      }
      clearSupabaseBrowserSession();
      lockApplication('You have been signed out from this browser.', true);
    } finally {
      signingOut = false;
    }
  }

  async function verifyActiveSession(restartWhenNeeded = false) {
    if (sessionCheckRunning || signingOut) return;
    const database = currentDatabase();
    if (!database?.auth?.getSession) {
      if (!currentSession()) lockApplication('', true);
      return;
    }

    sessionCheckRunning = true;
    try {
      const { data, error } = await database.auth.getSession();
      if (error || !data?.session?.user?.id) {
        lockApplication('', true);
        return;
      }

      const active = currentSession();
      const activeProfile = currentProfile();
      const changedUser = active?.user?.id !== data.session.user.id;
      if (restartWhenNeeded || changedUser || !activeProfile?.id) {
        await secureStartApplication(data.session);
      }
    } catch (error) {
      console.error('Session verification failed:', error);
      lockApplication('Your session could not be verified. Sign in again.', true);
    } finally {
      sessionCheckRunning = false;
    }
  }

  installSecurityStyles();
  replaceGlobalFunction('showAuth', secureShowAuth);
  replaceGlobalFunction('showApp', secureShowApp);
  replaceGlobalFunction('startApplication', secureStartApplication);
  replaceGlobalFunction('signOut', performSecureSignOut);

  const logoutButton = byElementId('logoutBtn');
  if (logoutButton && !logoutButton.dataset.kscSecureSignOut) {
    logoutButton.dataset.kscSecureSignOut = 'true';
    logoutButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      performSecureSignOut();
    }, true);
  }

  const shellObserver = new MutationObserver(() => {
    if (!authLocked) return;
    const shell = byElementId('appShell');
    if (!shell?.hidden || !shell.classList.contains('hidden') || shell.getAttribute('aria-hidden') !== 'true') {
      enforceLockedShell();
    }
  });
  const observedShell = byElementId('appShell');
  if (observedShell) {
    shellObserver.observe(observedShell, {
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      lockApplication('', true);
      verifyActiveSession(true);
    } else {
      verifyActiveSession(false);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) verifyActiveSession(false);
  });

  const database = currentDatabase();
  if (database?.auth?.onAuthStateChange) {
    database.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' || !nextSession) {
        lockApplication('', true);
      }
    });
  }

  window.setInterval(() => {
    if (authLocked) enforceLockedShell();
  }, 1000);
  window.setInterval(() => verifyActiveSession(false), 30000);

  if (currentSession()?.user?.id && currentProfile()?.id) revealAuthorizedApplication();
  else lockApplication('', true);
})();
