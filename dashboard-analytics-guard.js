'use strict';

(function installDashboardAnalyticsGuard() {
  if (window.__KSC_DASHBOARD_ANALYTICS_GUARD_V1__) return;
  window.__KSC_DASHBOARD_ANALYTICS_GUARD_V1__ = true;

  let syncing = false;
  let framePending = false;

  function canViewDashboard() {
    try {
      if (typeof hasPermission === 'function') return Boolean(hasPermission('dashboard_view'));
    } catch (_) {
      return false;
    }
    try { return profile?.role === 'admin'; }
    catch (_) { return false; }
  }

  function canViewAllBranches() {
    try {
      if (typeof hasPermission === 'function') return Boolean(hasPermission('reports_all_branches'));
    } catch (_) {
      return false;
    }
    try { return profile?.role === 'admin'; }
    catch (_) { return false; }
  }

  function activeView() {
    return String(document.querySelector('.nav-item.active[data-view]')?.dataset.view || document.body.dataset.module || '').trim().toLowerCase();
  }

  function accessibleReports() {
    try {
      const source = Array.isArray(reports) ? reports : [];
      if (canViewAllBranches() || !profile?.branch_id) return source;
      return source.filter((report) => report.branch_id === profile.branch_id);
    } catch (_) {
      return [];
    }
  }

  function accessibleBranchCount() {
    try {
      const source = Array.isArray(branches) ? branches : [];
      if (canViewAllBranches() || !profile?.branch_id) return source.length;
      return source.some((branch) => branch.id === profile.branch_id) ? 1 : 0;
    } catch (_) {
      return 0;
    }
  }

  function correctCoverage(section) {
    if (!section) return;
    const scopedReports = accessibleReports();
    const activeBranches = accessibleBranchCount();
    const submitted = new Set(scopedReports.map((report) => report.branch_id).filter(Boolean)).size;
    const coverage = activeBranches ? Math.round((submitted / activeBranches) * 100) : 0;

    const value = section.querySelector('#statCoverage');
    const note = section.querySelector('#statCoverageNote');
    if (value) value.textContent = `${coverage}%`;
    if (note) note.textContent = `${submitted} of ${activeBranches} active ${activeBranches === 1 ? 'branch' : 'branches'}`;
  }

  function secureAnalytics() {
    framePending = false;
    if (syncing) return;
    syncing = true;

    try {
      const section = document.getElementById('dashboardAnalytics');
      if (!section) return;

      section.dataset.section = 'dashboard';
      section.dataset.permission = 'dashboard_view';

      if (!canViewDashboard()) {
        section.replaceChildren();
        section.remove();
        return;
      }

      const dashboardActive = activeView() === 'dashboard';
      section.classList.toggle('view-hidden', !dashboardActive);
      section.setAttribute('aria-hidden', dashboardActive ? 'false' : 'true');
      correctCoverage(section);
    } finally {
      syncing = false;
    }
  }

  function queueSecureAnalytics() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(secureAnalytics);
  }

  const observer = new MutationObserver((mutations) => {
    if (syncing) return;
    if (mutations.some((mutation) => mutation.type === 'childList' || mutation.type === 'attributes')) {
      queueSecureAnalytics();
    }
  });

  function initialize() {
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'data-module']
    });
    queueSecureAnalytics();
    window.setTimeout(queueSecureAnalytics, 100);
    window.setTimeout(queueSecureAnalytics, 900);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.nav-item[data-view]')) window.setTimeout(queueSecureAnalytics, 0);
  }, true);
  document.addEventListener('ksc:permissions-refreshed', queueSecureAnalytics);
  window.addEventListener('pageshow', queueSecureAnalytics);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) queueSecureAnalytics();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();