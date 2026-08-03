'use strict';

(function installDashboardAnalyticsGuard() {
  if (window.__KSC_DASHBOARD_ANALYTICS_GUARD_V2__) return;
  window.__KSC_DASHBOARD_ANALYTICS_GUARD_V2__ = true;

  let syncing = false;
  let framePending = false;

  function installReconciliationAlignmentStyles() {
    if (document.getElementById('kscReconciliationAlignmentStyles')) return;

    const style = document.createElement('style');
    style.id = 'kscReconciliationAlignmentStyles';
    style.textContent = `
      #dashboardAnalytics .compact-reconciliation-card .recon-toolbar{
        margin-bottom:10px;
        padding-left:10px;
        padding-right:10px;
        box-sizing:border-box;
      }
      #dashboardAnalytics .compact-reconciliation-card .native-chart-frame{
        display:grid;
        width:100%;
        min-width:0;
        gap:0;
      }
      #dashboardAnalytics .compact-reconciliation-card .recon-table-head,
      #dashboardAnalytics .compact-reconciliation-card .recon-row,
      #dashboardAnalytics .compact-reconciliation-card .branch-bars{
        width:100%;
        min-width:0;
        box-sizing:border-box;
      }
      #dashboardAnalytics .compact-reconciliation-card .native-chart-frame.is-empty .recon-table-head,
      #dashboardAnalytics .compact-reconciliation-card .native-chart-frame.is-empty #branchBars{
        display:none!important;
      }
      #dashboardAnalytics .compact-reconciliation-card #branchChartEmpty.chart-empty{
        position:relative;
        inset:auto;
        width:100%;
        min-height:72px;
        margin:0;
        padding:18px 16px;
        box-sizing:border-box;
        place-items:center;
        border-radius:12px;
        background:#fbfcfe;
      }
      @media(max-width:760px){
        #dashboardAnalytics .compact-reconciliation-card #branchChartEmpty.chart-empty{
          min-height:84px;
          padding:20px 14px;
        }
      }
    `;
    document.head.appendChild(style);
  }

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

  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function correctCoverage(section) {
    if (!section) return;
    const scopedReports = accessibleReports();
    const activeBranches = accessibleBranchCount();
    const submitted = new Set(scopedReports.map((report) => report.branch_id).filter(Boolean)).size;
    const coverage = activeBranches ? Math.round((submitted / activeBranches) * 100) : 0;

    setText(section.querySelector('#statCoverage'), `${coverage}%`);
    setText(
      section.querySelector('#statCoverageNote'),
      `${submitted} of ${activeBranches} active ${activeBranches === 1 ? 'branch' : 'branches'}`
    );
  }

  function alignReconciliation(section) {
    const frame = section?.querySelector('.compact-reconciliation-card .native-chart-frame');
    if (!frame) return;

    const bars = frame.querySelector('#branchBars');
    const empty = frame.querySelector('#branchChartEmpty');
    const hasRows = Boolean(bars?.querySelector('.recon-row'));
    const isEmpty = !hasRows;

    frame.classList.toggle('is-empty', isEmpty);
    if (empty && empty.getAttribute('aria-hidden') !== (isEmpty ? 'false' : 'true')) {
      empty.setAttribute('aria-hidden', isEmpty ? 'false' : 'true');
    }
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
      if (section.getAttribute('aria-hidden') !== (dashboardActive ? 'false' : 'true')) {
        section.setAttribute('aria-hidden', dashboardActive ? 'false' : 'true');
      }
      correctCoverage(section);
      alignReconciliation(section);
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
    installReconciliationAlignmentStyles();
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