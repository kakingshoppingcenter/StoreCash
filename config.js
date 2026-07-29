// Supabase browser configuration.
// The publishable key is safe for client-side use when Row Level Security is enabled.
window.KSC_CONFIG = Object.freeze({
  supabaseUrl: 'https://cdmghdexjcqcmrwnbglw.supabase.co',
  supabasePublishableKey: 'sb_publishable_coaW1J3o1Ch0VChpZzEa1A_sh1QQ29F'
});

(function registerOfficialFavicon() {
  const iconUrl = './assets/kaking-store-cash-icon.svg?v=20260729-1332';

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

(function loadOptionalSystemFeatures() {
  const extensions = [
    {
      selector: 'script[data-ksc-report-reopen]',
      source: './report-reopen.js?v=20260729-1625',
      attribute: 'kscReportReopen'
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