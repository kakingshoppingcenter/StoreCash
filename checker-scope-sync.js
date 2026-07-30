'use strict';

(function installScopedCheckerSynchronization() {
  const REFRESH_INTERVAL_MS = 60 * 1000;
  let pollTimer = null;

  function status(mode, text) {
    const element = document.getElementById('realtimeStatus');
    if (!element) return;
    element.className = `live-sync-status ${mode}`;
    const label = element.querySelector('.live-sync-label');
    if (label) label.textContent = text;
  }

  async function refresh() {
    if (profile?.role !== 'checker' || !session?.user?.id || document.hidden) return;
    const controller = window.KSC_REALTIME_CONTROLLER;
    if (controller?.checkerDirty) return;
    try {
      status('syncing', 'Refreshing authorized fields…');
      await loadData();
      status('live', 'Restricted sync active');
    } catch (error) {
      console.error('Scoped checker refresh failed:', error);
      status(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? 'Retrying restricted sync…' : 'Offline — updates paused');
    }
  }

  async function activate() {
    if (profile?.role !== 'checker' || !db || !session?.user?.id) return false;
    const controller = window.KSC_REALTIME_CONTROLLER;
    if (controller) {
      window.clearTimeout(controller.timer);
      window.clearTimeout(controller.reconnectTimer);
      window.clearInterval(controller.fallbackTimer);
      if (controller.channel && !controller.channel.__checkerScopeManaged) {
        try { await db.removeChannel(controller.channel); } catch (_) { /* no-op */ }
      }
      controller.channel = { __checkerScopeManaged: true };
      controller.userId = session.user.id;
      controller.timer = null;
      controller.reconnectTimer = null;
      controller.fallbackTimer = null;
    }

    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    status('live', 'Restricted sync active');
    return true;
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener('online', refresh);
  window.addEventListener('offline', () => status('offline', 'Offline — updates paused'));

  const wait = window.setInterval(async () => {
    if (await activate()) window.clearInterval(wait);
  }, 250);
  window.setTimeout(() => window.clearInterval(wait), 20000);
})();
