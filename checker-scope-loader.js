'use strict';

(function loadDepositCheckerScopeFeature() {
  if (document.querySelector('script[data-ksc-checker-scope]')) return;
  const script = document.createElement('script');
  script.src = './checker-scope.js?v=20260730-1056';
  script.dataset.kscCheckerScope = 'true';
  script.async = false;
  script.onload = () => {
    window.setTimeout(() => {
      if (typeof session !== 'undefined' && session && typeof profile !== 'undefined' && profile?.role === 'checker' && typeof loadData === 'function') {
        loadData().catch((error) => console.error('Unable to load the authorized Deposit Checker scope.', error));
      }
    }, 0);
  };
  document.body.appendChild(script);
})();
