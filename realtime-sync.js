'use strict';

(function installRealtimeSynchronization() {
  if (window.KSC_REALTIME_CONTROLLER) return;

  const state = {
    channel: null,
    userId: null,
    timer: null,
    reconnectTimer: null,
    fallbackTimer: null,
    refreshing: false,
    queued: false,
    entryDirty: false,
    checkerDirty: false,
    payload: null
  };
  window.KSC_REALTIME_CONTROLLER = state;

  function installStyles() {
    if (document.getElementById('realtimeSyncStyles')) return;
    const style = document.createElement('style');
    style.id = 'realtimeSyncStyles';
    style.textContent = `
      .live-sync-status{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:7px 10px;border:1px solid #d7e2ee;border-radius:999px;background:#fff;color:#607086;font-size:10px;font-weight:750;white-space:nowrap;box-shadow:0 4px 14px rgba(18,40,72,.04)}
      .live-sync-dot{width:8px;height:8px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 4px rgba(148,163,184,.12)}
      .live-sync-status.live{border-color:#bfe6cb;background:#f1fbf4;color:#126d38}.live-sync-status.live .live-sync-dot{background:#1d9b50;box-shadow:0 0 0 4px rgba(29,155,80,.13)}
      .live-sync-status.syncing{border-color:#cfe0f5;background:#f4f8ff;color:#175caa}.live-sync-status.syncing .live-sync-dot{background:#1677ff;box-shadow:0 0 0 4px rgba(22,119,255,.12);animation:kscLivePulse 1s ease-in-out infinite}
      .live-sync-status.offline{border-color:#efc7c3;background:#fff5f3;color:#a52920}.live-sync-status.offline .live-sync-dot{background:#d92d20;box-shadow:0 0 0 4px rgba(217,45,32,.12)}
      @keyframes kscLivePulse{0%,100%{opacity:.55}50%{opacity:1}}
      @media(max-width:620px){.live-sync-status{min-height:42px;justify-content:center;border-radius:10px}.top-actions .live-sync-status{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureStatus() {
    let status = document.getElementById('realtimeStatus');
    if (status) return status;
    const actions = document.querySelector('.top-actions');
    if (!actions) return null;
    status = document.createElement('span');
    status.id = 'realtimeStatus';
    status.className = 'live-sync-status syncing';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.innerHTML = '<span class="live-sync-dot" aria-hidden="true"></span><span class="live-sync-label">Connecting live updates…</span>';
    actions.insertBefore(status, actions.querySelector('#refreshBtn'));
    return status;
  }

  function setStatus(mode, text) {
    const status = ensureStatus();
    if (!status) return;
    status.className = `live-sync-status ${mode}`;
    status.querySelector('.live-sync-label').textContent = text;
  }

  function entrySnapshot() {
    if (!state.entryDirty) return null;
    return {
      branch: byId('branch')?.value || '',
      date: byId('businessDate')?.value || '',
      customers: byId('customers')?.value || '0',
      remarks: byId('storeRemarks')?.value || '',
      payments: Object.fromEntries(PAYMENT_TYPES.map(({ key }) => [key, byId(`p_${key}`)?.value || '0']))
    };
  }

  function restoreEntry(saved) {
    if (!saved || !state.entryDirty) return;
    const branch = byId('branch');
    if (!branch || ![...branch.options].some((option) => option.value === saved.branch)) return;
    branch.value = saved.branch;
    byId('businessDate').value = saved.date;
    selectedEntryReport = reports.find((report) => report.branch_id === saved.branch && report.business_date === saved.date) || null;

    if (selectedEntryReport && !['draft', 'reopened'].includes(selectedEntryReport.status)) {
      state.entryDirty = false;
      loadEntryReport();
      showToast('This report changed and is now locked. The latest values were loaded.');
      return;
    }

    PAYMENT_TYPES.forEach(({ key }) => { byId(`p_${key}`).value = saved.payments[key]; });
    byId('customers').value = saved.customers;
    byId('storeRemarks').value = saved.remarks;
    if (selectedEntryReport) {
      byId('entryStatus').textContent = statusLabel(selectedEntryReport.status);
      byId('entryStatus').className = `badge ${STATUS_CLASSES[selectedEntryReport.status] || 'neutral'}`;
      setEntryLocked(false);
    }
    updateEntryTotal();
  }

  function checkerSnapshot() {
    if (!state.checkerDirty) return null;
    return {
      reportId: byId('checkerReportSelect')?.value || '',
      actual: byId('actualReceived')?.value || '0',
      reading: byId('reading')?.value || '0',
      remarks: byId('checkerRemarks')?.value || ''
    };
  }

  function restoreChecker(saved) {
    if (!saved || !state.checkerDirty) return;
    const select = byId('checkerReportSelect');
    if (!select || ![...select.options].some((option) => option.value === saved.reportId)) return;
    select.value = saved.reportId;
    selectedCheckerReport = reports.find((report) => report.id === saved.reportId) || null;
    byId('actualReceived').value = saved.actual;
    byId('reading').value = saved.reading;
    byId('checkerRemarks').value = saved.remarks;
    byId('checkerReportLabel').textContent = selectedCheckerReport ? `${selectedCheckerReport.branches?.name || 'Unknown'} · ${formatDate(selectedCheckerReport.business_date)}` : 'No report selected';
    byId('checkerReported').textContent = formatMoney(selectedCheckerReport?.reported_total || 0);
    updateCheckerDifference();
  }

  async function refreshProfile(table, payload) {
    if (table !== 'profiles' || !session?.user?.id) return;
    const changedId = payload?.new?.id || payload?.old?.id;
    if (changedId && changedId !== session.user.id) return;
    try {
      await loadProfile();
      applyRoleVisibility();
    } catch (error) {
      await db.auth.signOut();
      showAuth(error.message || 'Your account access changed. Sign in again.');
      throw error;
    }
  }

  async function refreshAdministration(table) {
    if (currentView !== 'administration') return;
    if (table === 'branches' && typeof loadBranchesAdministration === 'function' && hasPermission('manage_branches')) await loadBranchesAdministration();
    if (table === 'profiles' && typeof loadUserAdministration === 'function' && hasPermission('manage_users')) await loadUserAdministration(true);
  }

  async function refreshData(table = '', payload = null) {
    if (!db || !session || byId('appShell')?.classList.contains('hidden')) return;
    if (state.refreshing) { state.queued = true; return; }

    state.refreshing = true;
    setStatus('syncing', 'Syncing latest updates…');
    const savedEntry = entrySnapshot();
    const savedChecker = checkerSnapshot();

    try {
      await refreshProfile(table, payload);
      const reportDate = byId('filterDate')?.value || today;
      const [branchResult, reportResult] = await Promise.all([
        db.from('branches').select('id,code,name,active').eq('active', true).order('name'),
        db.from('daily_reports').select('*,branches(id,code,name),deposit_verifications(id,actual_received,reading,difference,remarks,verified_by,verified_at)').eq('business_date', reportDate).order('created_at', { ascending: false })
      ]);
      if (branchResult.error) throw branchResult.error;
      if (reportResult.error) throw reportResult.error;

      branches = branchResult.data || [];
      reports = reportResult.data || [];
      if (canReviewAudit()) {
        const auditResult = await db.from('audit_logs').select('id,actor_id,actor_name,action,entity_type,entity_id,created_at').order('created_at', { ascending: false }).limit(200);
        if (auditResult.error) throw auditResult.error;
        audits = auditResult.data || [];
      } else audits = [];

      populateBranchOptions();
      renderMetrics();
      renderReports();
      populateReportSelectors();
      renderAudits();
      loadEntryReport();
      restoreEntry(savedEntry);
      restoreChecker(savedChecker);
      await refreshAdministration(table);
      setConnection(true, 'Connected securely to Supabase');
      setStatus('live', 'Live updates active');
    } catch (error) {
      console.error('Realtime refresh failed:', error);
      setStatus(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? 'Reconnecting live updates…' : 'Offline — updates paused');
    } finally {
      state.refreshing = false;
      if (state.queued) {
        state.queued = false;
        window.setTimeout(() => refreshData(table, payload), 120);
      }
    }
  }

  function schedule(table = '', payload = null, delay = 320) {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => refreshData(table, payload), delay);
  }

  function relevant(table, payload) {
    if (table !== 'daily_reports') return true;
    const selectedDate = byId('filterDate')?.value;
    const changedDate = payload?.new?.business_date || payload?.old?.business_date;
    return !selectedDate || !changedDate || selectedDate === changedDate;
  }

  async function removeChannel() {
    window.clearTimeout(state.reconnectTimer);
    if (state.channel && db) {
      try { await db.removeChannel(state.channel); } catch (_) { /* no-op */ }
    }
    state.channel = null;
    state.userId = null;
  }

  async function startChannel() {
    if (!db || !session?.user?.id) return;
    if (state.channel && state.userId === session.user.id) return;
    await removeChannel();
    state.userId = session.user.id;
    setStatus('syncing', 'Connecting live updates…');

    let channel = db.channel(`ksc-live-${session.user.id}-${Date.now()}`);
    ['daily_reports', 'deposit_verifications', 'branches', 'profiles', 'audit_logs'].forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (relevant(table, payload)) schedule(table, payload);
      });
    });

    state.channel = channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setStatus('live', 'Live updates active');
        schedule('', null, 80);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setStatus('syncing', 'Reconnecting live updates…');
        state.reconnectTimer = window.setTimeout(() => removeChannel().finally(startChannel), 2500);
      } else if (status === 'CLOSED' && session?.user?.id) {
        setStatus('syncing', 'Reconnecting live updates…');
      }
    });
  }

  function installDirtyTracking() {
    byId('entryForm')?.addEventListener('input', () => { state.entryDirty = true; });
    byId('entryForm')?.addEventListener('change', () => { state.entryDirty = true; });
    ['actualReceived', 'reading', 'checkerRemarks'].forEach((id) => byId(id)?.addEventListener('input', () => { state.checkerDirty = true; }));
    byId('checkerReportSelect')?.addEventListener('change', () => { state.checkerDirty = false; });
    byId('clearEntryBtn')?.addEventListener('click', () => { state.entryDirty = false; });

    if (typeof showToast === 'function' && !showToast.kscRealtimeWrapped) {
      const original = showToast;
      const wrapped = function realtimeAwareToast(message, type = 'normal') {
        if (type === 'success') {
          if (/draft saved|daily report submitted/i.test(message)) state.entryDirty = false;
          if (/deposit verification saved/i.test(message)) state.checkerDirty = false;
        }
        return original(message, type);
      };
      wrapped.kscRealtimeWrapped = true;
      showToast = wrapped;
    }
  }

  function initialize() {
    installStyles();
    ensureStatus();
    installDirtyTracking();

    state.fallbackTimer = window.setInterval(() => {
      if (!document.hidden && navigator.onLine && session?.user?.id) schedule('', null, 0);
    }, 15000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && session?.user?.id) { startChannel(); schedule('', null, 60); }
    });
    window.addEventListener('online', () => { setStatus('syncing', 'Reconnecting live updates…'); startChannel(); schedule('', null, 60); });
    window.addEventListener('offline', () => setStatus('offline', 'Offline — updates paused'));

    db?.auth?.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { removeChannel(); setStatus('offline', 'Signed out'); }
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') window.setTimeout(startChannel, 150);
    });

    const wait = window.setInterval(() => {
      if (db && session?.user?.id) { window.clearInterval(wait); startChannel(); }
    }, 250);
    window.setTimeout(() => window.clearInterval(wait), 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
