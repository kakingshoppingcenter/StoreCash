'use strict';
(function installReportingRange() {
  if (window.KSC_REPORTING_RANGE) return;
  const VERSION = '20260803-1408';
  const STORAGE_PREFIX = 'ksc:reporting-period:';
  const REPORT_SELECT = '*,branches(id,code,name),deposit_verifications(id,actual_received,reading,difference,remarks,verified_by,verified_at)';
  const state = { version: VERSION, loading: false, queued: false, lastKey: '', poll: null, takeover: null };
  window.KSC_REPORTING_RANGE = state;
  const el = (id) => document.getElementById(id);

  function view() {
    try { return String(currentView || document.body.dataset.module || '').toLowerCase(); }
    catch (_) { return String(document.body.dataset.module || '').toLowerCase(); }
  }
  function userId() {
    try { return session?.user?.id ? String(session.user.id) : ''; }
    catch (_) { return ''; }
  }
  function ymd(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function valid(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
  function addDays(value, days) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    return ymd(date);
  }
  function week(value) {
    const date = new Date(`${value}T12:00:00`);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    const from = ymd(date);
    return { from, to: addDays(from, 6) };
  }
  function storageKey() { return `${STORAGE_PREFIX}${userId() || 'browser'}`; }
  function saved() {
    try { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); }
    catch (_) { return {}; }
  }
  function persist(period) {
    try { localStorage.setItem(storageKey(), JSON.stringify(period)); }
    catch (_) { /* storage is optional */ }
  }
  function selectedPeriod() {
    const mode = el('reportMode')?.value || 'day';
    const anchor = el('filterDate')?.value || ymd(new Date());
    if (mode === 'week') return { mode, anchor, ...week(anchor) };
    if (mode === 'range') return { mode, anchor, from: el('filterFrom')?.value || anchor, to: el('filterTo')?.value || anchor };
    return { mode: 'day', anchor, from: anchor, to: anchor };
  }
  function effectivePeriod() {
    if (view() === 'entry') {
      const date = el('businessDate')?.value || ymd(new Date());
      return { mode: 'entry', anchor: date, from: date, to: date };
    }
    return selectedPeriod();
  }
  function periodOkay(period, notify = true) {
    let message = '';
    if (!valid(period.from) || !valid(period.to)) message = 'Select a valid reporting period.';
    else if (period.from > period.to) message = 'From Date cannot be later than To Date.';
    else if (((new Date(`${period.to}T12:00:00`) - new Date(`${period.from}T12:00:00`)) / 86400000) + 1 > 366) message = 'The reporting range cannot exceed 366 days.';
    if (message && notify && typeof showToast === 'function') showToast(message, 'error');
    return !message;
  }
  function label(period = selectedPeriod()) {
    const format = (value) => typeof formatDate === 'function' ? formatDate(value) : value;
    return period.from === period.to ? format(period.from) : `${format(period.from)} – ${format(period.to)}`;
  }

  function installStyles() {
    if (el('kscReportingRangeStyles')) return;
    const style = document.createElement('style');
    style.id = 'kscReportingRangeStyles';
    style.textContent = `
      .toolbar.reporting-range-toolbar{display:grid;grid-template-columns:minmax(125px,.7fr) minmax(155px,.9fr) minmax(155px,.9fr) minmax(155px,.9fr) auto minmax(175px,1fr);align-items:end;gap:12px}
      .toolbar.reporting-range-toolbar label{max-width:none;min-width:0}
      .reporting-range-actions{display:flex;gap:8px;align-items:center}
      .reporting-range-summary{align-self:center;justify-self:end;text-align:right;min-width:0}
      .reporting-range-summary strong{display:block;color:#26344b;font-size:11px;line-height:1.35}
      .reporting-range-summary span{display:block;margin-top:3px;color:#748298;font-size:9px}
      .reporting-range-hidden{display:none!important}
      @media(max-width:1180px){.toolbar.reporting-range-toolbar{grid-template-columns:repeat(3,minmax(0,1fr))}.reporting-range-summary{grid-column:1/-1;justify-self:start;text-align:left}}
      @media(max-width:700px){.toolbar.reporting-range-toolbar{grid-template-columns:1fr 1fr}.reporting-mode-field,.reporting-range-actions,.reporting-range-summary{grid-column:1/-1}.reporting-range-actions{display:grid;grid-template-columns:1fr 1fr}.reporting-range-actions .btn{min-height:44px}}
      @media(max-width:430px){.toolbar.reporting-range-toolbar{grid-template-columns:1fr}.reporting-mode-field,.reporting-range-actions,.reporting-range-summary{grid-column:1}}
    `;
    document.head.appendChild(style);
  }
  function field(className, text, control) {
    const node = document.createElement('label');
    node.className = className;
    node.append(document.createTextNode(text), control);
    return node;
  }
  function installControls() {
    const toolbar = document.querySelector('.toolbar');
    const date = el('filterDate');
    if (!toolbar || !date) return false;
    if (el('reportMode')) return true;
    toolbar.classList.add('reporting-range-toolbar');
    const dateField = date.closest('label');
    dateField.classList.add('reporting-anchor-field');
    const mode = document.createElement('select');
    mode.id = 'reportMode';
    mode.innerHTML = '<option value="day">Day</option><option value="week">Week</option><option value="range">Date Range</option>';
    const from = document.createElement('input'); from.id = 'filterFrom'; from.type = 'date';
    const to = document.createElement('input'); to.id = 'filterTo'; to.type = 'date';
    const actions = document.createElement('div');
    actions.className = 'reporting-range-actions';
    actions.innerHTML = '<button id="applyReportingPeriod" class="btn primary" type="button">Apply</button><button id="resetReportingPeriod" class="btn ghost" type="button">Today</button>';
    const summary = document.createElement('div');
    summary.className = 'reporting-range-summary';
    summary.innerHTML = '<strong id="reportingPeriodLabel"></strong><span id="reportingPeriodHint"></span>';
    toolbar.insertBefore(field('reporting-mode-field', 'Reporting Mode', mode), dateField);
    dateField.insertAdjacentElement('afterend', field('reporting-from-field', 'From Date', from));
    from.closest('label').insertAdjacentElement('afterend', field('reporting-to-field', 'To Date', to));
    to.closest('label').insertAdjacentElement('afterend', actions);
    toolbar.appendChild(summary);
    const prior = saved();
    const fallback = date.value || ymd(new Date());
    mode.value = ['day', 'week', 'range'].includes(prior.mode) ? prior.mode : 'day';
    date.value = valid(prior.anchor) ? prior.anchor : fallback;
    from.value = valid(prior.from) ? prior.from : date.value;
    to.value = valid(prior.to) ? prior.to : date.value;
    syncControls(false);
    return true;
  }
  function syncControls(save = true) {
    const period = selectedPeriod();
    const anchorField = el('filterDate')?.closest('label');
    const fromField = el('filterFrom')?.closest('label');
    const toField = el('filterTo')?.closest('label');
    anchorField?.classList.toggle('reporting-range-hidden', period.mode === 'range');
    fromField?.classList.toggle('reporting-range-hidden', period.mode !== 'range');
    toField?.classList.toggle('reporting-range-hidden', period.mode !== 'range');
    if (anchorField?.firstChild) anchorField.firstChild.textContent = period.mode === 'week' ? 'Week Containing' : 'Reporting Date';
    if (period.mode === 'week') { el('filterFrom').value = period.from; el('filterTo').value = period.to; }
    if (el('reportingPeriodLabel')) el('reportingPeriodLabel').textContent = label(period);
    if (el('reportingPeriodHint')) el('reportingPeriodHint').textContent = period.mode === 'day' ? 'Daily report' : period.mode === 'week' ? 'Monday to Sunday' : 'Custom date range';
    if (save) persist(period);
    updateTitles();
  }
  function updateTitles() {
    const title = el('pageTitle');
    const current = view();
    const period = selectedPeriod();
    if (title && current === 'dashboard') title.textContent = period.mode === 'day' ? 'Daily Operations Dashboard' : period.mode === 'week' ? 'Weekly Operations Dashboard' : 'Period Operations Dashboard';
    const badge = document.querySelector('#dashboardAnalytics .analytics-period');
    if (badge) badge.textContent = label(period);
  }
  function setBusy(busy, silent) {
    const apply = el('applyReportingPeriod');
    if (apply) { apply.disabled = busy; apply.textContent = busy ? 'Loading…' : 'Apply'; }
    if (el('refreshBtn')) el('refreshBtn').disabled = busy;
    if (!silent) {
      const live = el('realtimeStatus');
      const text = live?.querySelector('.live-sync-label');
      if (live) live.className = `live-sync-status ${busy ? 'syncing' : 'live'}`;
      if (text) text.textContent = busy ? 'Loading reporting period…' : 'Automatic updates active';
    }
  }

  async function rangeLoad(options = {}) {
    const silent = Boolean(options.silent);
    const force = Boolean(options.force);
    const period = effectivePeriod();
    if (!periodOkay(period, !silent) || !db || !session?.user?.id) return false;
    const key = `${view()}:${period.mode}:${period.from}:${period.to}`;
    if (!force && state.lastKey === key) { syncControls(false); return true; }
    if (state.loading) { state.queued = true; return false; }
    state.loading = true;
    setBusy(true, silent);
    try {
      const auditPromise = typeof canReviewAudit === 'function' && canReviewAudit()
        ? db.from('audit_logs').select('id,actor_id,actor_name,action,entity_type,entity_id,created_at').gte('created_at', `${period.from}T00:00:00`).lt('created_at', `${addDays(period.to, 1)}T00:00:00`).order('created_at', { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null });
      const [branchResult, reportResult, auditResult] = await Promise.all([
        db.from('branches').select('id,code,name,active').eq('active', true).order('name'),
        db.from('daily_reports').select(REPORT_SELECT).gte('business_date', period.from).lte('business_date', period.to).order('business_date', { ascending: false }).order('created_at', { ascending: false }),
        auditPromise
      ]);
      if (branchResult.error) throw branchResult.error;
      if (reportResult.error) throw reportResult.error;
      if (auditResult.error) throw auditResult.error;
      branches = branchResult.data || [];
      reports = reportResult.data || [];
      audits = auditResult.data || [];
      state.lastKey = key;
      populateBranchOptions();
      renderMetrics();
      renderReports();
      populateReportSelectors();
      renderAudits();
      if (period.mode === 'entry') loadEntryReport();
      const empty = el('reportRows')?.querySelector('.empty-state');
      if (empty && !reports.length) empty.textContent = 'No reports found for the selected reporting period.';
      syncControls(false);
      setConnection(true, 'Connected securely to Supabase');
      el('setupNotice')?.classList.add('hidden');
      document.dispatchEvent(new CustomEvent('ksc:reporting-period-loaded', { detail: { ...period, count: reports.length } }));
      return true;
    } catch (error) {
      console.error('Reporting period load failed:', error);
      setConnection(false, 'Supabase setup or connection error');
      if (/relation .* does not exist|Could not find the table|schema cache/i.test(error.message || '')) el('setupNotice')?.classList.remove('hidden');
      if (!silent && typeof showToast === 'function') showToast(error.message || 'Unable to load the reporting period.', 'error');
      return false;
    } finally {
      state.loading = false;
      setBusy(false, silent);
      if (state.queued) { state.queued = false; setTimeout(() => rangeLoad({ silent: true, force: true }), 80); }
    }
  }
  function schedule(delay = 120) {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => rangeLoad({ silent: true, force: true }), delay);
  }
  async function disableLegacyRealtime() {
    const controller = window.KSC_REALTIME_CONTROLLER;
    if (!controller || !db || !session?.user?.id) return false;
    clearTimeout(controller.timer);
    clearTimeout(controller.reconnectTimer);
    clearInterval(controller.fallbackTimer);
    if (controller.channel && !controller.channel.__reportingRangeManaged) {
      try { await db.removeChannel(controller.channel); } catch (_) { /* no-op */ }
    }
    controller.channel = { __reportingRangeManaged: true };
    controller.userId = session.user.id;
    controller.timer = null;
    controller.reconnectTimer = null;
    controller.fallbackTimer = null;
    const live = el('realtimeStatus');
    const text = live?.querySelector('.live-sync-label');
    if (live) live.className = 'live-sync-status live';
    if (text) text.textContent = 'Automatic updates active';
    return true;
  }
  function intercept(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (event.type === 'click' && target.closest('#refreshBtn')) {
      event.preventDefault(); event.stopImmediatePropagation(); state.lastKey = ''; rangeLoad({ force: true });
    } else if (event.type === 'change' && target.id === 'filterDate') {
      event.stopImmediatePropagation(); syncControls(); if (el('reportMode').value !== 'range') { state.lastKey = ''; rangeLoad({ force: true }); }
    } else if (event.type === 'change' && target.id === 'businessDate') {
      event.stopImmediatePropagation(); state.lastKey = ''; rangeLoad({ force: true });
    }
  }
  function bind() {
    document.addEventListener('click', intercept, true);
    document.addEventListener('change', intercept, true);
    el('reportMode').addEventListener('change', () => { syncControls(); if (el('reportMode').value !== 'range') { state.lastKey = ''; rangeLoad({ force: true }); } });
    el('filterFrom').addEventListener('change', () => syncControls());
    el('filterTo').addEventListener('change', () => syncControls());
    el('applyReportingPeriod').addEventListener('click', () => { syncControls(); state.lastKey = ''; rangeLoad({ force: true }); });
    el('resetReportingPeriod').addEventListener('click', () => {
      const value = ymd(new Date());
      el('reportMode').value = 'day'; el('filterDate').value = value; el('filterFrom').value = value; el('filterTo').value = value;
      syncControls(); state.lastKey = ''; rangeLoad({ force: true });
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest?.('.nav-item[data-view]')) return;
      setTimeout(() => { updateTitles(); const period = effectivePeriod(); const key = `${view()}:${period.mode}:${period.from}:${period.to}`; if (state.lastKey !== key) rangeLoad({ silent: true, force: true }); }, 0);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { disableLegacyRealtime(); schedule(50); } });
    window.addEventListener('online', () => { disableLegacyRealtime(); schedule(50); });
  }
  function patchGlobalLoad() {
    try { loadData = rangeLoad; } catch (_) { /* event capture remains active */ }
    try { window.loadData = rangeLoad; } catch (_) { /* no-op */ }
  }
  function initialize() {
    installStyles();
    if (!installControls()) { setTimeout(initialize, 80); return; }
    patchGlobalLoad();
    bind();
    syncControls(false);
    state.takeover = setInterval(async () => { if (await disableLegacyRealtime()) clearInterval(state.takeover); }, 250);
    setTimeout(() => clearInterval(state.takeover), 20000);
    clearInterval(state.poll);
    state.poll = setInterval(() => { if (!document.hidden && navigator.onLine && session?.user?.id) schedule(0); }, 30000);
    setTimeout(() => { state.lastKey = ''; rangeLoad({ silent: true, force: true }); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
