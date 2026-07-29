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

(function loadProtectedAdministratorDeletion() {
  function loadExtension() {
    if (document.querySelector('script[data-ksc-admin-delete]')) return;
    const script = document.createElement('script');
    script.src = './admin-delete.js?v=20260729-1503';
    script.dataset.kscAdminDelete = 'true';
    script.async = true;
    document.body.appendChild(script);
  }

  if (document.readyState === 'complete') {
    window.setTimeout(loadExtension, 0);
  } else {
    window.addEventListener('load', loadExtension, { once: true });
  }
})();
