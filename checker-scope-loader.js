'use strict';

(function loadDepositCheckerScopeFeature() {
  function loadStylesheet(selector, source, datasetKey) {
    if (document.querySelector(selector)) return;
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = source;
    stylesheet.dataset[datasetKey] = 'true';
    document.head.appendChild(stylesheet);
  }

  loadStylesheet(
    'link[data-ksc-mobile-polish]',
    './mobile-polish.css?v=20260731-1410',
    'kscMobilePolish'
  );

  if (document.querySelector('script[data-ksc-checker-scope]')) return;

  function loadSupportingFeature(selector, source, attribute) {
    if (document.querySelector(selector)) return;
    const supportingScript = document.createElement('script');
    supportingScript.src = source;
    supportingScript.dataset[attribute] = 'true';
    supportingScript.async = false;
    document.body.appendChild(supportingScript);
  }

  const script = document.createElement('script');
  script.src = './checker-scope.js?v=20260730-1056';
  script.dataset.kscCheckerScope = 'true';
  script.async = false;
  script.onload = () => {
    loadStylesheet(
      'link[data-ksc-checker-layout]',
      './checker-layout.css?v=20260731-1704',
      'kscCheckerLayout'
    );

    loadSupportingFeature(
      'script[data-ksc-checker-scope-sync]',
      './checker-scope-sync.js?v=20260730-1056',
      'kscCheckerScopeSync'
    );
    loadSupportingFeature(
      'script[data-ksc-checker-scope-export]',
      './checker-scope-export.js?v=20260730-1056',
      'kscCheckerScopeExport'
    );

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
