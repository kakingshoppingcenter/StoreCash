'use strict';

(function installAuthenticationSecurityGuard() {
  if (window.__KSC_AUTH_SECURITY_V2__) return;
  window.__KSC_AUTH_SECURITY_V2__ = true;

  const LOCKED_CLASS = 'ksc-auth-locked';
  const AUTHENTICATED_CLASS = 'ksc-authenticated';
  const MODULE_STORAGE_PREFIX = 'ksc:last-module:';
  let locked = true;
  let authorizing = false;
  let pendingReveal = false;
  let signingOut = false;
  let checkingSession = false;

  const element = (id) => document.getElementById(id);

  function activeSession() {
    try { return typeof session !== 'undefined' ? session : null; }
    catch (_) { return null; }
  }

  function activeProfile() {
    try { return typeof profile !== 'undefined' ? profile : null; }
    catch (_) { return null; }
  }

  function database() {
    try { return typeof db !== 'undefined' ? db : null; }
    catch (_) { return null; }
  }

  function installSecurityStyles() {
    if (element('kscAuthenticationSecurityStyles')) return;
    const style = document.createElement('style');
    style.id = 'kscAuthenticationSecurityStyles';
    style.textContent = `
      html body #appShell.hidden,
      html body #appShell[hidden],
      html body #appShell[aria-hidden="true"],
      html body.${LOCKED_CLASS} #appShell{
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
      html body.${LOCKED_CLASS} #authScreen{
        display:grid!important;
        visibility:visible!important;
        pointer-events:auto!important;
      }
    `;
    document.head.appendChild(style);
  }

  function setText(id, value) {
    const target = element(id);
    if (target) target.textContent = value;
  }

  function setValue(id, value) {
    const target = element(id);
    if (target && 'value' in target) target.value = value;
  }

  function clearHtml(id, html = '') {
    const target = element(id);
    if (target) target.innerHTML = html;
  }

  function removeModuleLocation() {
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
      // Protected content is already removed even when URL rewriting is blocked.
    }
  }

  function removeModuleStorage(userId) {
    if (!userId) return;
    const key = `${MODULE_STORAGE_PREFIX}${userId}`;
    try { window.localStorage.removeItem(key); } catch (_) { /* no-op */ }
    try { window.sessionStorage.removeItem(key); } catch (_) { /* no-op */ }
  }

  function removeSupabaseBrowserSession() {
    try {
      const projectRef = new URL(String(window.KSC_CONFIG?.supabaseUrl || '')).hostname.split('.')[0];
      if (!projectRef) return;
      const prefix = `sb-${projectRef}-auth-token`;
      [window.localStorage, window.sessionStorage].forEach((storage) => {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index);
          if (key?.startsWith(prefix)) storage.removeItem(key);
        }
      });
    } catch (_) {
      // Supabase signOut is the primary session-removal mechanism.
    }
  }

  function resetBindings() {
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

  function wipeRenderedData() {
    ['entryForm', 'userAdminForm', 'branchAdminForm'].forEach((id) => {
      const form = element(id);
      if (form && typeof form.reset === 'function') form.reset();
    });

    ['reportRows', 'auditRows', 'adminBranchRows', 'adminUserRows'].forEach((id) => clearHtml(id));
    clearHtml('executiveSummary', '<div class="empty-state">Sign in to view authorized report information.</div>');
    clearHtml('checkerReportSelect', '<option value="">Sign in required</option>');
    clearHtml('summaryReportSelect', '<option value="">Sign in required</option>');
    clearHtml('branch');

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

    [
      ['actualReceived', '0'], ['reading', '0'], ['checkerRemarks', ''],
      ['receivedBy', ''], ['customers', '0'], ['storeRemarks', ''],
      ['reportSearch', ''], ['userFullName', ''], ['userEmail', ''],
      ['userPassword', ''], ['branchCode', ''], ['branchName', ''],
      ['loginPassword', '']
    ].forEach(([id, value]) => setValue(id, value));

    document.querySelectorAll('#paymentFields input').forEach((input) => { input.value = '0'; });

    const overlay = element('loadingOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }

    const toast = element('toast');
    if (toast) {
      toast.textContent = '';
      toast.className = 'toast';
    }
  }

  function enforceLockedShell() {
    const auth = element('authScreen');
    const shell = element('appShell');

    document.body.classList.add(LOCKED_CLASS);
    document.body.classList.remove(AUTHENTICATED_CLASS);

    if (shell) {
      shell.classList.add('hidden');
      shell.hidden = true;
      shell.inert = true;
      shell.setAttribute('aria-hidden', 'true');
      shell.style.setProperty('display', 'none', 'important');
      shell.style.setProperty('visibility', 'hidden', 'important');
      shell.style.setProperty('pointer-events', 'none', 'important');
    }

    if (auth) {
      auth.classList.remove('hidden');
      auth.hidden = false;
      auth.inert = false;
      auth.setAttribute('aria-hidden', 'false');
      auth.style.removeProperty('display');
      auth.style.removeProperty('visibility');
      auth.style.removeProperty('pointer-events');
    }
  }

  function lockApplication(message = '', options = {}) {
    const { wipe = true, clearNavigation = true } = options;
    const userId = activeSession()?.user?.id || null;
    locked = true;
    pendingReveal = false;

    if (clearNavigation) {
      removeModuleStorage(userId);
      removeModuleLocation();
    }
    if (wipe) {
      resetBindings();
      wipeRenderedData();
    }

    enforceLockedShell();
    if (message) setText('authMessage', message);
    document.title = 'Sign in · Kaking Store Cash';
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }

  function revealApplication() {
    const currentSession = activeSession();
    const currentProfile = activeProfile();
    if (!currentSession?.user?.id || !currentProfile?.id || currentProfile.active === false) {
      lockApplication('Your secure session is not available. Sign in again.');
      return false;
    }

    const auth = element('authScreen');
    const shell = element('appShell');
    locked = false;

    document.body.classList.remove(LOCKED_CLASS);
    document.body.classList.add(AUTHENTICATED_CLASS);

    if (auth) {
      auth.classList.add('hidden');
      auth.hidden = true;
      auth.inert = true;
      auth.setAttribute('aria-hidden', 'true');
      auth.style.setProperty('display', 'none', 'important');
    }

    if (shell) {
      shell.classList.remove('hidden');
      shell.hidden = false;
      shell.inert = false;
      shell.setAttribute('aria-hidden', 'false');
      shell.style.removeProperty('display');
      shell.style.removeProperty('visibility');
      shell.style.removeProperty('pointer-events');
    }

    setText('authMessage', '');
    return true;
  }

  const baseStartApplication = (() => {
    try { return typeof startApplication === 'function' ? startApplication : null; }
    catch (_) { return null; }
  })();

  function secureShowAuth(message = '') {
    lockApplication(message);
  }

  function secureShowApp() {
    if (authorizing) {
      pendingReveal = true;
      return;
    }
    revealApplication();
  }

  async function secureStartApplication(nextSession) {
    if (!nextSession?.user?.id || !baseStartApplication) {
      lockApplication('');
      return;
    }

    authorizing = true;
    pendingReveal = false;
    lockApplication('', { wipe: true, clearNavigation: false });

    try {
      await baseStartApplication(nextSession);
    } finally {
      authorizing = false;
      if (activeSession()?.user?.id && activeProfile()?.id && (pendingReveal || locked)) {
        revealApplication();
      } else if (!activeSession()?.user?.id || !activeProfile()?.id) {
        enforceLockedShell();
      }
      pendingReveal = false;
    }
  }

  function replaceGlobal(name, replacement) {
    try {
      if (name === 'showAuth') showAuth = replacement;
      else if (name === 'showApp') showApp = replacement;
      else if (name === 'startApplication') startApplication = replacement;
      else if (name === 'signOut') signOut = replacement;
    } catch (_) {
      // Window assignment below covers contexts without a writable lexical binding.
    }
    try { window[name] = replacement; } catch (_) { /* no-op */ }
  }

  async function performSecureSignOut() {
    if (signingOut) return;
    signingOut = true;
    const client = database();
    const userId = activeSession()?.user?.id || null;

    lockApplication('Signing out securely…');
    removeModuleStorage(userId);

    try {
      if (client?.auth?.signOut) {
        const result = await client.auth.signOut();
        if (result?.error) throw result.error;
      }
      removeSupabaseBrowserSession();
      lockApplication('You have signed out successfully.');
    } catch (error) {
      console.error('Secure sign-out failed:', error);
      try {
        if (client?.auth?.signOut) await client.auth.signOut({ scope: 'local' });
      } catch (_) {
        // Local storage cleanup below is the final browser safeguard.
      }
      removeSupabaseBrowserSession();
      lockApplication('You have been signed out from this browser.');
    } finally {
      signingOut = false;
    }
  }

  async function verifySession(restart = false) {
    if (checkingSession || signingOut) return;
    const client = database();
    if (!client?.auth?.getSession) {
      if (!activeSession()) lockApplication('');
      return;
    }

    checkingSession = true;
    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session?.user?.id) {
        lockApplication('');
        return;
      }

      const current = activeSession();
      const changedUser = current?.user?.id !== data.session.user.id;
      if (restart || changedUser || !activeProfile()?.id) {
        await secureStartApplication(data.session);
      }
    } catch (error) {
      console.error('Session verification failed:', error);
      lockApplication('Your session could not be verified. Sign in again.');
    } finally {
      checkingSession = false;
    }
  }

  installSecurityStyles();
  replaceGlobal('showAuth', secureShowAuth);
  replaceGlobal('showApp', secureShowApp);
  replaceGlobal('startApplication', secureStartApplication);
  replaceGlobal('signOut', performSecureSignOut);

  const logout = element('logoutBtn');
  if (logout && !logout.dataset.kscSecureSignOut) {
    logout.dataset.kscSecureSignOut = 'true';
    logout.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      performSecureSignOut();
    }, true);
  }

  const shell = element('appShell');
  if (shell) {
    const observer = new MutationObserver(() => {
      if (!locked) return;
      if (!shell.hidden || !shell.classList.contains('hidden') || shell.getAttribute('aria-hidden') !== 'true') {
        enforceLockedShell();
      }
    });
    observer.observe(shell, {
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      lockApplication('', { wipe: true, clearNavigation: false });
      verifySession(true);
    } else {
      verifySession(false);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) verifySession(false);
  });

  const client = database();
  if (client?.auth?.onAuthStateChange) {
    client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' || !nextSession) lockApplication('');
    });
  }

  window.setInterval(() => {
    if (locked) enforceLockedShell();
  }, 1000);
  window.setInterval(() => verifySession(false), 30000);

  if (activeSession()?.user?.id && activeProfile()?.id) revealApplication();
  else {
    lockApplication('', { wipe: true, clearNavigation: false });
    window.setTimeout(() => verifySession(false), 0);
  }
})();
