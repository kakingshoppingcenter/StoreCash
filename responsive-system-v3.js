'use strict';

(function installResponsiveSystemV3() {
  if (window.__KSC_RESPONSIVE_SYSTEM_V3__) return;
  window.__KSC_RESPONSIVE_SYSTEM_V3__ = true;

  function installResponsiveStyles() {
    let stylesheet = document.querySelector('link[data-ksc-responsive-system-v3]');
    if (!stylesheet) {
      stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.dataset.kscResponsiveSystemV3 = 'true';
      // Keep the final authority in the body so the legacy professional head
      // observer cannot move another stylesheet after it.
      document.body.appendChild(stylesheet);
    }
    stylesheet.href = './responsive-system-v3.css?v=20260801-1123';
  }

  installResponsiveStyles();

  const TABLE_HEADERS = new WeakMap();
  let framePending = false;
  let lastViewport = '';

  function viewportWidth() {
    return Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
  }

  function viewportHeight() {
    return Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  }

  function viewportMode(width = viewportWidth()) {
    if (width <= 760) return 'phone';
    if (width <= 1180) return 'tablet';
    return 'desktop';
  }

  function isTextEntry(element = document.activeElement) {
    return Boolean(element?.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,select,[contenteditable="true"]'));
  }

  function updateViewportState() {
    const width = viewportWidth();
    const height = viewportHeight();
    const mode = viewportMode(width);
    const fullHeight = Math.round(window.innerHeight || height);
    const keyboardOpen = mode === 'phone'
      && isTextEntry()
      && fullHeight > 0
      && height < fullHeight * 0.76;

    document.documentElement.style.setProperty('--ksc-viewport-height', `${Math.max(height, 320)}px`);
    document.body.dataset.viewport = mode;
    document.body.classList.toggle('ksc-keyboard-open', keyboardOpen);

    if (lastViewport !== mode) {
      lastViewport = mode;
      document.dispatchEvent(new CustomEvent('ksc:viewport-change', { detail: { mode, width, height } }));
    }
  }

  function cleanLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function enhanceTable(table) {
    if (!table) return;
    let headers = TABLE_HEADERS.get(table);
    if (!headers || !headers.length) {
      headers = [...table.querySelectorAll('thead th')].map((cell) => cleanLabel(cell.textContent));
      TABLE_HEADERS.set(table, headers);
    }

    table.querySelectorAll('tbody tr').forEach((row) => {
      const cells = [...row.children].filter((cell) => cell.tagName === 'TD');
      if (cells.length === 1 && cells[0].hasAttribute('colspan')) return;
      cells.forEach((cell, index) => {
        const label = headers[index];
        if (label && !cell.dataset.label) cell.dataset.label = label;
      });
    });
  }

  function enhanceTables() {
    document.querySelectorAll('table').forEach(enhanceTable);
  }

  function enhanceControls() {
    document.querySelectorAll('input[type="number"]').forEach((input) => {
      if (!input.inputMode) input.inputMode = input.step && input.step !== '1' ? 'decimal' : 'numeric';
    });

    document.querySelectorAll('input[type="email"]').forEach((input) => {
      input.inputMode = 'email';
      input.autocapitalize = 'none';
      input.spellcheck = false;
    });

    const logout = document.getElementById('logoutBtn');
    if (logout) {
      logout.title = 'Sign Out';
      logout.setAttribute('aria-label', 'Sign Out');
    }

    const password = document.getElementById('changePasswordBtn');
    if (password) {
      password.title = 'Change Password';
      password.setAttribute('aria-label', 'Change Password');
    }
  }

  function centerActiveNavigation(behavior = 'smooth') {
    if (viewportMode() !== 'phone') return;
    const active = document.querySelector('.sidebar .nav-item.active:not(.hidden):not([hidden])');
    if (!active) return;
    try {
      active.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
    } catch (_) {
      active.scrollIntoView();
    }
  }

  function enhanceNavigation() {
    document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
      const label = cleanLabel(button.textContent);
      if (label && !button.getAttribute('aria-label')) button.setAttribute('aria-label', label);
    });
  }

  function applyEnhancements() {
    framePending = false;
    updateViewportState();
    enhanceControls();
    enhanceNavigation();
    enhanceTables();
  }

  function queueEnhancements() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(applyEnhancements);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.nav-item[data-view]')) {
      window.setTimeout(() => centerActiveNavigation('smooth'), 20);
    }
  }, true);

  document.addEventListener('focusin', () => {
    updateViewportState();
    if (viewportMode() !== 'phone' || !isTextEntry()) return;
    window.setTimeout(() => {
      try {
        document.activeElement?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } catch (_) {
        // Native browser keyboard handling remains available.
      }
    }, 250);
  });

  document.addEventListener('focusout', () => {
    window.setTimeout(updateViewportState, 120);
  });

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList' || mutation.type === 'attributes')) {
      queueEnhancements();
    }
  });

  function initialize() {
    installResponsiveStyles();
    applyEnhancements();
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-hidden']
    });
    window.setTimeout(() => centerActiveNavigation('auto'), 300);
  }

  window.addEventListener('resize', queueEnhancements, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(queueEnhancements, 120), { passive: true });
  window.visualViewport?.addEventListener('resize', queueEnhancements, { passive: true });
  window.visualViewport?.addEventListener('scroll', updateViewportState, { passive: true });
  window.addEventListener('pageshow', queueEnhancements);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) queueEnhancements();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
