// Supabase browser configuration.
// The publishable key is safe for client-side use when Row Level Security is enabled.
window.KSC_CONFIG = Object.freeze({
  supabaseUrl: 'https://cdmghdexjcqcmrwnbglw.supabase.co',
  supabasePublishableKey: 'sb_publishable_coaW1J3o1Ch0VChpZzEa1A_sh1QQ29F'
});

(function installSecureSessionRestoreScreen() {
  if (document.getElementById('secureSessionRestore')) return;

  const style = document.createElement('style');
  style.id = 'secureSessionRestoreStyles';
  style.textContent = `
    .secure-session-restore{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:24px;background:rgba(8,18,32,.22);-webkit-backdrop-filter:blur(14px) saturate(110%);backdrop-filter:blur(14px) saturate(110%);color:#fff;opacity:1;visibility:visible;transition:opacity .22s ease,visibility .22s ease}
    .secure-session-restore:before,.secure-session-restore:after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(255,255,255,.06);pointer-events:none}
    .secure-session-restore:before{width:620px;height:620px;right:-260px;top:-280px}
    .secure-session-restore:after{width:460px;height:460px;left:-260px;bottom:-270px}
    .secure-session-restore.finished{opacity:0;visibility:hidden;pointer-events:none}
    .secure-session-card{position:relative;z-index:1;width:min(430px,100%);display:grid;justify-items:center;gap:14px;padding:34px 28px;text-align:center;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(5,24,47,.55);box-shadow:0 28px 70px rgba(0,0,0,.18);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
    .secure-session-logo{width:84px;height:84px;object-fit:contain;filter:drop-shadow(0 10px 18px rgba(0,0,0,.18))}
    .secure-session-card h2{margin:2px 0 0;font-size:23px;letter-spacing:-.025em}
    .secure-session-card p{margin:0;color:#d8e3ef;font-size:12px;line-height:1.55}
    .secure-session-spinner{width:34px;height:34px;margin-top:4px;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:secureSessionSpin .75s linear infinite}
    .secure-session-reload{display:none;margin-top:3px;border:1px solid rgba(255,255,255,.22);border-radius:9px;padding:9px 14px;background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
    .secure-session-reload.visible{display:inline-flex}
    @keyframes secureSessionSpin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(style);

  const screen = document.createElement('div');
  screen.id = 'secureSessionRestore';
  screen.className = 'secure-session-restore';
  screen.setAttribute('role', 'status');
  screen.setAttribute('aria-live', 'polite');
  screen.innerHTML = `
    <div class="secure-session-card">
      <img class="secure-session-logo" src="./assets/kaking-store-cash-icon.svg?v=20260729-1647" alt="Kaking Store Cash logo" />
      <h2>Restoring secure session</h2>
      <div class="secure-session-spinner" aria-hidden="true"></div>
      <p id="secureSessionRestoreText">Verifying your saved account and loading authorized access…</p>
      <button id="secureSessionReloadBtn" class="secure-session-reload" type="button">Reload System</button>
    </div>`;
  document.body.appendChild(screen);

  const startedAt = Date.now();
  let finished = false;
  let observer = null;
  let interval = null;

  function finishRestore() {
    if (finished) return;
    finished = true;
    window.clearInterval(interval);
    observer?.disconnect();
    screen.classList.add('finished');
    window.setTimeout(() => screen.remove(), 260);
  }

  function inspectApplicationState() {
    if (finished) return;

    const appShell = document.getElementById('appShell');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const authMessage = document.getElementById('authMessage')?.textContent.trim() || '';
    const appVisible = Boolean(appShell && !appShell.classList.contains('hidden'));
    const applicationLoading = Boolean(loadingOverlay && !loadingOverlay.classList.contains('hidden'));
    const elapsed = Date.now() - startedAt;

    if (appVisible && !applicationLoading) {
      finishRestore();
      return;
    }

    // No saved session, an expired session, or an authorization error: reveal login safely.
    if (!appVisible && !applicationLoading && (authMessage || elapsed >= 1400)) {
      finishRestore();
      return;
    }

    const status = document.getElementById('secureSessionRestoreText');
    const reload = document.getElementById('secureSessionReloadBtn');
    if (elapsed >= 10000 && status) {
      status.textContent = 'The secure connection is taking longer than expected. Check your internet connection.';
    }
    if (elapsed >= 18000 && reload) reload.classList.add('visible');
  }

  document.getElementById('secureSessionReloadBtn')?.addEventListener('click', () => window.location.reload());

  observer = new MutationObserver(inspectApplicationState);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class']
  });

  interval = window.setInterval(inspectApplicationState, 120);
  inspectApplicationState();
})();

(function registerOfficialFavicon() {
  const iconUrl = './assets/kaking-store-cash-icon.svg?v=20260729-1647';

  function applyFavicon() {
    document
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .forEach((link) => link.remove());

    [
      { rel: 'icon', type: 'image/svg+xml' },
      { rel: 'shortcut icon', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', type: 'image/svg+xml' }
    ].forEach(({ rel, type }) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.type = type;
      link.href = iconUrl;
      document.head.appendChild(link);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFavicon, { once: true });
  } else {
    applyFavicon();
  }
})();

(function hideDatabaseConnectionStatus() {
  const style = document.createElement('style');
  style.id = 'hideDatabaseConnectionStatus';
  style.textContent = '.connection-status{display:none!important}';
  document.head.appendChild(style);
})();

(function loadOptionalSystemFeatures() {
  const extensions = [
    {
      selector: 'script[data-ksc-admin-function-compat]',
      source: './admin-function-compat.js?v=20260729-1845',
      attribute: 'kscAdminFunctionCompat'
    },
    {
      selector: 'script[data-ksc-production-hardening]',
      source: './production-hardening.js?v=20260729-1718',
      attribute: 'kscProductionHardening'
    },
    {
      selector: 'script[data-ksc-report-reopen]',
      source: './report-reopen.js?v=20260729-1625',
      attribute: 'kscReportReopen'
    },
    {
      selector: 'script[data-ksc-report-save-guard]',
      source: './report-save-guard.js?v=20260729-1643',
      attribute: 'kscReportSaveGuard'
    },
    {
      selector: 'script[data-ksc-password-change]',
      source: './password-change.js?v=20260729-1605',
      attribute: 'kscPasswordChange'
    },
    {
      selector: 'script[data-ksc-password-responsive]',
      source: './password-change-responsive.js?v=20260729-1605',
      attribute: 'kscPasswordResponsive'
    },
    {
      selector: 'script[data-ksc-admin-delete]',
      source: './admin-delete.js?v=20260729-1503',
      attribute: 'kscAdminDelete'
    },
    {
      selector: 'script[data-ksc-admin-sample-data-direct]',
      source: './admin-sample-data-direct.js?v=20260804-0902',
      attribute: 'kscAdminSampleDataDirect'
    },
    {
      selector: 'script[data-ksc-admin-sample-data]',
      source: './admin-sample-data.js?v=20260804-0902',
      attribute: 'kscAdminSampleData'
    },
    {
      selector: 'script[data-ksc-dashboard-analytics]',
      source: './dashboard-analytics.js?v=20260729-1932',
      attribute: 'kscDashboardAnalytics'
    },
    {
      selector: 'script[data-ksc-excel-export]',
      source: './export-excel.js?v=20260803-1555',
      attribute: 'kscExcelExport'
    },
    {
      selector: 'script[data-ksc-realtime-sync]',
      source: './realtime-sync.js?v=20260729-2030',
      attribute: 'kscRealtimeSync'
    },
    {
      selector: 'script[data-ksc-checker-scope-loader]',
      source: './checker-scope-loader.js?v=20260730-1056',
      attribute: 'kscCheckerScopeLoader'
    }
  ];

  function loadExtensions() {
    extensions.forEach((extension) => {
      if (document.querySelector(extension.selector)) return;
      const script = document.createElement('script');
      script.src = extension.source;
      script.dataset[extension.attribute] = 'true';
      script.async = false;
      document.body.appendChild(script);
    });
  }

  if (document.readyState === 'complete') {
    window.setTimeout(loadExtensions, 0);
  } else {
    window.addEventListener('load', loadExtensions, { once: true });
  }
})();