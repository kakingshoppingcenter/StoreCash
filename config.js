// The Supabase publishable key is intentionally safe for browser use.
// Database access is protected by Supabase Auth and Row Level Security policies.
window.KSC_CONFIG = Object.freeze({
  supabaseUrl: 'https://cdmghdexjcqcmrwnbglw.supabase.co',
  supabasePublishableKey: 'sb_publishable_coaW1J3o1Ch0VChpZzEa1A_sh1QQ29F'
});

// The official logo is stored directly in this GitHub repository.
// The version query prevents browsers and Vercel from showing an older cached logo.
(function registerKakingStoreCashBrand() {
  const logoUrl = 'assets/kaking-store-cash-icon.svg?v=official-logo-2026-07-29';

  function applyBrand() {
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((link) => link.remove());

    [
      { rel: 'icon', type: 'image/svg+xml' },
      { rel: 'shortcut icon', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', type: 'image/svg+xml' }
    ].forEach(({ rel, type }) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.type = type;
      link.href = logoUrl;
      document.head.appendChild(link);
    });

    const brandStyle = document.createElement('style');
    brandStyle.id = 'official-kaking-store-cash-brand';
    brandStyle.textContent = `.brand-mark{background-image:url("${logoUrl}")!important;background-color:transparent!important;background-repeat:no-repeat!important;background-position:center!important;background-size:contain!important}`;
    document.head.appendChild(brandStyle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrand, { once: true });
  } else {
    applyBrand();
  }
})();
