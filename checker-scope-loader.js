'use strict';

(function loadDepositCheckerScopeFeature() {
  if (document.querySelector('script[data-ksc-checker-scope]')) return;

  function loadScopedSynchronization() {
    if (document.querySelector('script[data-ksc-checker-scope-sync]')) return;
    const syncScript = document.createElement('script');
    syncScript.src = './checker-scope-sync.js?v=20260730-1056';
    syncScript.dataset.kscCheckerScopeSync = 'true';
    syncScript.async = false;
    document.body.appendChild(syncScript);
  }

  const script = document.createElement('script');
  script.src = './checker-scope.js?v=20260730-1056';
  script.dataset.kscCheckerScope = 'true';
  script.async = false;
  script.onload = () => {
    loadScopedSynchronization();
    window.setTimeout(async () => {
      if (typeof session === 'undefined' || !session || typeof profile === 'undefined' || profile?.role !== 'checker') return;
      try {
        if (typeof loadProfile === 'function') await loadProfile();
        if (typeof loadData === 'function') await loadData();
      } catch (error) {
        console.error('Unable to load the authorized Deposit Checker scope.', error);
        if (typeof showToast === 'function') showToast(error.message || 'Unable to load the authorized Deposit Checker scope.', 'error');
      }
    }, 0);
  };
  document.body.appendChild(script);
})();
