'use strict';

(function installKakingProfessionalInterface() {
  if (window.__KSC_PROFESSIONAL_UI__) return;
  window.__KSC_PROFESSIONAL_UI__ = true;

  const STYLE_URL = './professional-ui.css?v=20260731-1805';
  const MODULE_META = {
    dashboard: {
      eyebrow: 'Operations Overview',
      title: 'Daily Operations Dashboard',
      description: 'Monitor daily submissions, deposit reconciliation, customer totals, and operational exceptions.'
    },
    entry: {
      eyebrow: 'Store Reporting',
      title: 'Daily Store Entry',
      description: 'Encode and submit one complete branch payment summary for the selected business date.'
    },
    checker: {
      eyebrow: 'Deposit Control',
      title: 'Deposit Verification',
      description: 'Validate submitted branch deposits against the payment fields authorized for your account.'
    },
    reports: {
      eyebrow: 'Reporting Center',
      title: 'Branch Reports',
      description: 'Review branch submissions, verification status, amounts received, and recorded differences.'
    },
    summary: {
      eyebrow: 'Management Review',
      title: 'Executive Summary',
      description: 'Examine the selected branch report and its complete authorized financial breakdown.'
    },
    audit: {
      eyebrow: 'Governance and Control',
      title: 'Audit Trail',
      description: 'Review recorded system activity for accountability, traceability, and operational control.'
    },
    administration: {
      eyebrow: 'System Control',
      title: 'System Administration',
      description: 'Manage branches, authorized users, roles, permissions, checker scope, and protected system controls.'
    }
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
    { label: 'Workspace', before: 'dashboard' },
    { label: 'Insights', before: 'reports' },
    { label: 'Control', before: 'administration' }
  ];

  let headObserver = null;
  let bodyObserver = null;
  let contextQueued = false;
  let tableQueued = false;

  function ensureStylesheet() {
    let link = document.querySelector('link[data-ksc-professional-ui]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = STYLE_URL;
      link.dataset.kscProfessionalUi = 'true';
      document.head.appendChild(link);
    } else if (!String(link.href).includes('20260731-1805')) {
      link.href = STYLE_URL;
    }

    if (document.head.lastElementChild !== link) document.head.appendChild(link);
    return link;
  }

  function keepStylesheetLast() {
    ensureStylesheet();
    if (headObserver) return;
    headObserver = new MutationObserver(() => {
      const link = document.querySelector('link[data-ksc-professional-ui]');
      if (link && document.head.lastElementChild !== link) document.head.appendChild(link);
    });
    headObserver.observe(document.head, { childList: true });
  }

  function ensureSkipLink() {
    if (document.querySelector('.ksc-skip-link')) return;
    const main = document.querySelector('#appShell main');
    if (!main) return;
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
      const view = String(button.dataset.view || '');
      if (!button.querySelector('.nav-icon') && ICONS[view]) {
        const icon = document.createElement('span');
        icon.className = 'nav-icon';
        icon.innerHTML = ICONS[view];
        button.prepend(icon);
      }
      const meta = MODULE_META[view];
      if (meta) button.title = `${meta.title}: ${meta.description}`;
    });

    NAV_GROUPS.forEach(({ label, before }) => {
      const target = nav.querySelector(`.nav-item[data-view="${before}"]`);
      if (!target) return;
      const previous = target.previousElementSibling;
      if (previous?.classList.contains('nav-group-label') && previous.dataset.group === before) return;
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

  function ensurePageSubtitle() {
    const title = document.getElementById('pageTitle');
    if (!title) return null;
    let subtitle = document.getElementById('pageSubtitle');
    if (!subtitle) {
      subtitle = document.createElement('p');
      subtitle.id = 'pageSubtitle';
      subtitle.className = 'ksc-page-subtitle';
      title.insertAdjacentElement('afterend', subtitle);
    }
    return subtitle;
  }

  function updateModuleContext() {
    contextQueued = false;
    decorateNavigation();
    const view = activeModule();
    const meta = MODULE_META[view] || MODULE_META.dashboard;
    document.body.dataset.module = view;

    document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
      const active = button.dataset.view === view && !button.classList.contains('hidden');
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    const eyebrow = document.querySelector('.topbar .eyebrow');
    if (eyebrow) eyebrow.textContent = meta.eyebrow;
    const title = document.getElementById('pageTitle');
    if (title && title.textContent.trim() !== meta.title) title.textContent = meta.title;
    const subtitle = ensurePageSubtitle();
    if (subtitle) subtitle.textContent = meta.description;
    document.title = `${meta.title} · Kaking Store Cash`;
  }

  function queueContextUpdate() {
    if (contextQueued) return;
    contextQueued = true;
    window.requestAnimationFrame(updateModuleContext);
  }

  function readableHeaderText(cell) {
    return String(cell?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function enhanceTable(table) {
    const headers = [...table.querySelectorAll('thead th')].map(readableHeaderText);
    table.querySelectorAll('tbody tr').forEach((row) => {
      const cells = [...row.children].filter((cell) => cell.tagName === 'TD');
      if (cells.length === 1 && cells[0].hasAttribute('colspan')) return;
      cells.forEach((cell, index) => {
        if (headers[index]) cell.dataset.label = headers[index];
      });

      const clickable = row.matches('[data-report-id],[data-admin-user-id],[data-admin-branch-id]');
      if (clickable && !row.hasAttribute('tabindex')) {
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          row.click();
        });
      }
    });
  }

  function enhanceTables() {
    tableQueued = false;
    document.querySelectorAll('table').forEach(enhanceTable);
  }

  function queueTableEnhancement() {
    if (tableQueued) return;
    tableQueued = true;
    window.requestAnimationFrame(enhanceTables);
  }

  function improveControls() {
    const reportSearch = document.getElementById('reportSearch');
    if (reportSearch && !reportSearch.getAttribute('aria-label')) reportSearch.setAttribute('aria-label', 'Search branch reports');

    document.querySelectorAll('input[type="number"]').forEach((input) => {
      if (!input.inputMode) input.inputMode = input.step && input.step !== '1' ? 'decimal' : 'numeric';
    });

    document.querySelectorAll('button').forEach((button) => {
      if (!button.type) button.type = 'button';
    });
  }

  function observeInterface() {
    if (bodyObserver) return;
    bodyObserver = new MutationObserver((mutations) => {
      let needsContext = false;
      let needsTables = false;
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target.classList?.contains('nav-item')) needsContext = true;
        if (mutation.type === 'childList') {
          needsTables = true;
          if ([...mutation.addedNodes].some((node) => node.nodeType === 1 && (node.matches?.('.nav-item,table,tbody,tr') || node.querySelector?.('.nav-item,table,tbody,tr')))) {
            needsContext = true;
          }
        }
      }
      if (needsContext) queueContextUpdate();
      if (needsTables) queueTableEnhancement();
    });
    bodyObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function initializeProfessionalInterface() {
    keepStylesheetLast();
    ensureSkipLink();
    decorateNavigation();
    improveControls();
    updateModuleContext();
    enhanceTables();
    observeInterface();

    window.setInterval(() => {
      decorateNavigation();
      queueContextUpdate();
      queueTableEnhancement();
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfessionalInterface, { once: true });
  } else {
    initializeProfessionalInterface();
  }

  window.addEventListener('load', () => {
    window.setTimeout(() => {
      ensureStylesheet();
      queueContextUpdate();
      queueTableEnhancement();
    }, 350);
  }, { once: true });
})();
