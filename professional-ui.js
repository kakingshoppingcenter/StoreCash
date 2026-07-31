'use strict';

(function installKakingProfessionalInterface() {
  if (window.__KSC_PROFESSIONAL_UI_V2__) return;
  window.__KSC_PROFESSIONAL_UI_V2__ = true;

  const STYLESHEETS = [
    { selector: 'link[data-ksc-professional-ui]', source: './professional-ui.css?v=20260731-1815', key: 'kscProfessionalUi' },
    { selector: 'link[data-ksc-professional-flow]', source: './professional-ui-flow.css?v=20260731-1815', key: 'kscProfessionalFlow' }
  ];

  const MODULE_META = {
    dashboard: ['Operations Overview', 'Daily Operations Dashboard', 'Monitor daily submissions, deposit reconciliation, customer totals, and operational exceptions.'],
    entry: ['Store Reporting', 'Daily Store Entry', 'Encode and submit one complete branch payment summary for the selected business date.'],
    checker: ['Deposit Control', 'Deposit Verification', 'Validate submitted branch deposits against the payment fields authorized for your account.'],
    reports: ['Reporting Center', 'Branch Reports', 'Review branch submissions, verification status, amounts received, and recorded differences.'],
    summary: ['Management Review', 'Executive Summary', 'Examine the selected branch report and its complete authorized financial breakdown.'],
    audit: ['Governance and Control', 'Audit Trail', 'Review recorded system activity for accountability, traceability, and operational control.'],
    administration: ['System Control', 'System Administration', 'Manage branches, authorized users, roles, permissions, checker scope, and protected system controls.']
  };

  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    entry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>',
    checker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.3 8.2-8 9-4.7-.8-8-4-8-9V7z"/><path d="M8.5 12.2l2.2 2.2 4.8-5"/></svg>',
    reports: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    summary: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h16"/><path d="M7 15l4-4 3 2 5-6"/><path d="M16 7h3v3"/></svg>',
    audit: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11l2 2 4-4"/></svg>',
    administration: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1H9.6V21a1.7 1.7 0 0 0-.4-1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 3.8 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H2.1V9.6h.1a1.7 1.7 0 0 0 1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.26 3.4l.06.06A1.7 1.7 0 0 0 8.2 3.8a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4v.1a1.7 1.7 0 0 0 .4 1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.2a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1 .4h.1v4H21a1.7 1.7 0 0 0-1 .4 1.7 1.7 0 0 0-.6 1z"/></svg>'
  };

  const NAV_GROUPS = [
    ['Workspace', 'dashboard'],
    ['Insights', 'reports'],
    ['Control', 'administration']
  ];

  let headObserver = null;
  let bodyObserver = null;
  let contextPending = false;
  let tablesPending = false;

  function ensureStylesheets() {
    const links = STYLESHEETS.map(({ selector, source, key }) => {
      let link = document.querySelector(selector);
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.dataset[key] = 'true';
      }
      if (!link.href.endsWith(source.replace('./', ''))) link.href = source;
      return link;
    });

    links.forEach((link) => document.head.appendChild(link));
    return links;
  }

  function keepDesignLast() {
    ensureStylesheets();
    if (headObserver) return;
    headObserver = new MutationObserver(() => {
      const flow = document.querySelector('link[data-ksc-professional-flow]');
      if (flow && document.head.lastElementChild !== flow) ensureStylesheets();
    });
    headObserver.observe(document.head, { childList: true });
  }

  function ensureSkipLink() {
    const main = document.querySelector('#appShell main');
    if (!main || document.querySelector('.ksc-skip-link')) return;
    if (!main.id) main.id = 'mainContent';
    main.tabIndex = -1;
    const link = document.createElement('a');
    link.className = 'ksc-skip-link';
    link.href = `#${main.id}`;
    link.textContent = 'Skip to main content';
    document.body.prepend(link);
  }

  function decorateNavigation() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;

    nav.querySelectorAll('.nav-item[data-view]').forEach((button) => {
      const view = button.dataset.view || '';
      if (!button.querySelector('.nav-icon') && ICONS[view]) {
        const icon = document.createElement('span');
        icon.className = 'nav-icon';
        icon.innerHTML = ICONS[view];
        button.prepend(icon);
      }
      const meta = MODULE_META[view];
      if (meta) button.title = `${meta[1]}: ${meta[2]}`;
    });

    NAV_GROUPS.forEach(([label, before]) => {
      const target = nav.querySelector(`.nav-item[data-view="${before}"]`);
      if (!target) return;
      const previous = target.previousElementSibling;
      if (previous?.matches(`.nav-group-label[data-group="${before}"]`)) return;
      const marker = document.createElement('div');
      marker.className = 'nav-group-label';
      marker.dataset.group = before;
      marker.textContent = label;
      target.before(marker);
    });
  }

  function activeModule() {
    return document.querySelector('.nav-item.active[data-view]:not(.hidden)')?.dataset.view || 'dashboard';
  }

  function ensureSubtitle() {
    const title = document.getElementById('pageTitle');
    if (!title) return null;
    let subtitle = document.getElementById('pageSubtitle');
    if (!subtitle) {
      subtitle = document.createElement('p');
      subtitle.id = 'pageSubtitle';
      subtitle.className = 'ksc-page-subtitle';
      title.after(subtitle);
    }
    return subtitle;
  }

  function updateModuleContext() {
    contextPending = false;
    decorateNavigation();
    const view = activeModule();
    const [eyebrowText, titleText, description] = MODULE_META[view] || MODULE_META.dashboard;
    document.body.dataset.module = view;

    document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
      if (button.dataset.view === view && !button.classList.contains('hidden')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    const eyebrow = document.querySelector('.topbar .eyebrow');
    const title = document.getElementById('pageTitle');
    const subtitle = ensureSubtitle();
    if (eyebrow) eyebrow.textContent = eyebrowText;
    if (title) title.textContent = titleText;
    if (subtitle) subtitle.textContent = description;
    document.title = `${titleText} · Kaking Store Cash`;
  }

  function queueContext() {
    if (contextPending) return;
    contextPending = true;
    requestAnimationFrame(updateModuleContext);
  }

  function enhanceTable(table) {
    const headers = [...table.querySelectorAll('thead th')].map((cell) => String(cell.textContent || '').replace(/\s+/g, ' ').trim());
    table.querySelectorAll('tbody tr').forEach((row) => {
      const cells = [...row.children].filter((cell) => cell.tagName === 'TD');
      if (!(cells.length === 1 && cells[0].hasAttribute('colspan'))) {
        cells.forEach((cell, index) => {
          if (headers[index]) cell.dataset.label = headers[index];
        });
      }

      if (row.matches('[data-report-id],[data-admin-user-id],[data-admin-branch-id]') && !row.hasAttribute('tabindex')) {
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.addEventListener('keydown', (event) => {
          if (!['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          row.click();
        });
      }
    });
  }

  function enhanceTables() {
    tablesPending = false;
    document.querySelectorAll('table').forEach(enhanceTable);
  }

  function queueTables() {
    if (tablesPending) return;
    tablesPending = true;
    requestAnimationFrame(enhanceTables);
  }

  function improveControls() {
    const search = document.getElementById('reportSearch');
    if (search && !search.getAttribute('aria-label')) search.setAttribute('aria-label', 'Search branch reports');
    document.querySelectorAll('input[type="number"]').forEach((input) => {
      if (!input.inputMode) input.inputMode = input.step && input.step !== '1' ? 'decimal' : 'numeric';
    });
  }

  function observeInterface() {
    if (bodyObserver) return;
    bodyObserver = new MutationObserver((mutations) => {
      let contextChanged = false;
      let tableChanged = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.target.classList?.contains('nav-item')) contextChanged = true;
        if (mutation.type === 'childList') {
          tableChanged = true;
          if ([...mutation.addedNodes].some((node) => node.nodeType === 1 && (node.matches?.('.nav-item,table,tbody,tr') || node.querySelector?.('.nav-item,table,tbody,tr')))) contextChanged = true;
        }
      });
      if (contextChanged) queueContext();
      if (tableChanged) queueTables();
    });
    bodyObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }

  function refreshInterface() {
    ensureStylesheets();
    decorateNavigation();
    improveControls();
    queueContext();
    queueTables();
  }

  function initialize() {
    keepDesignLast();
    ensureSkipLink();
    refreshInterface();
    observeInterface();
    setTimeout(refreshInterface, 400);
    setTimeout(refreshInterface, 2400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();

  window.addEventListener('pageshow', refreshInterface);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshInterface();
  });
})();
