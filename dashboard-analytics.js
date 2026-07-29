'use strict';

(function installDashboardAnalytics() {
  const charts = {};
  const compact = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 });

  function loadAnalyticsAssets() {
    if (!document.querySelector('link[data-ksc-dashboard-analytics]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './dashboard-analytics.css?v=20260729-1912';
      link.dataset.kscDashboardAnalytics = 'true';
      document.head.appendChild(link);
    }

    if (window.Chart) return Promise.resolve();
    const existing = document.querySelector('script[data-ksc-chartjs]');
    if (existing) {
      return new Promise((resolve) => {
        if (window.Chart) resolve();
        else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', resolve, { once: true });
        }
      });
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';
      script.dataset.kscChartjs = 'true';
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  function addSection() {
    if (document.getElementById('dashboardAnalytics')) return;
    const metrics = document.querySelector('.metrics[data-section="dashboard"]');
    if (!metrics) return;
    const section = document.createElement('section');
    section.id = 'dashboardAnalytics';
    section.className = 'dashboard-analytics';
    section.dataset.section = 'dashboard';
    section.innerHTML = `
      <div class="analytics-heading">
        <div><h3>Daily Performance Analytics</h3><p>Live statistics and reconciliation insights for the selected reporting date.</p></div>
        <span class="analytics-period">Selected reporting date</span>
      </div>
      <div class="analytics-stats">
        <article class="analytics-stat" id="statCoverageCard"><span class="analytics-stat-label">Submission Coverage</span><strong class="analytics-stat-value" id="statCoverage">0%</strong><small class="analytics-stat-note" id="statCoverageNote">0 of 0 active branches</small></article>
        <article class="analytics-stat" id="statMatchedCard"><span class="analytics-stat-label">Matched Reports</span><strong class="analytics-stat-value" id="statMatched">0</strong><small class="analytics-stat-note" id="statMatchedNote">0% of submissions</small></article>
        <article class="analytics-stat"><span class="analytics-stat-label">Average per Customer</span><strong class="analytics-stat-value" id="statAverage">₱0.00</strong><small class="analytics-stat-note">Reported total divided by customers</small></article>
        <article class="analytics-stat" id="statAttentionCard"><span class="analytics-stat-label">Attention Required</span><strong class="analytics-stat-value" id="statAttention">0</strong><small class="analytics-stat-note" id="statAttentionNote">0 pending · 0 with difference</small></article>
      </div>
      <div class="analytics-grid">
        <article class="analytics-card trend-card">
          <div class="analytics-card-head"><div><h4>Branch Reconciliation</h4><p>Reported totals compared with verified amounts received.</p></div><span class="analytics-tag">Branch View</span></div>
          <div class="chart-frame" id="branchChartFrame"><canvas id="branchChart"></canvas><div id="branchChartEmpty" class="chart-empty hidden">No branch submissions are available for this date.</div></div>
        </article>
        <article class="analytics-card payment-card">
          <div class="analytics-card-head"><div><h4>Payment Channel Mix</h4><p>Share of the total by payment method.</p></div><span class="analytics-tag">Payment Mix</span></div>
          <div class="chart-frame"><canvas id="paymentMixChart"></canvas><div id="paymentMixEmpty" class="chart-empty hidden">No payment amounts have been reported for this date.</div></div>
        </article>
        <article class="analytics-card branch-card">
          <div class="analytics-card-head"><div><h4>Reconciliation Status</h4><p>Submission status and reports needing follow-up.</p></div><span class="analytics-tag">Control Status</span></div>
          <div class="chart-frame"><canvas id="statusChart"></canvas><div id="statusChartEmpty" class="chart-empty hidden">No report statuses are available for this date.</div></div>
          <div class="analytics-footnote">Pending reports have not yet received deposit verification.</div>
        </article>
      </div>`;
    metrics.insertAdjacentElement('afterend', section);
  }

  function empty(id, show, text) {
    const node = document.getElementById(id);
    if (!node) return;
    if (text) node.textContent = text;
    node.classList.toggle('hidden', !show);
  }

  function replaceChart(name, canvasId, config) {
    if (!window.Chart) return;
    if (charts[name]) charts[name].destroy();
    charts[name] = new window.Chart(document.getElementById(canvasId), config);
  }

  function plugins() {
    return {
      legend: { labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 14, color: '#526177', font: { family: 'Inter', size: 10, weight: '600' } } },
      tooltip: { backgroundColor: '#132238', titleColor: '#fff', bodyColor: '#e7eef7', padding: 11, cornerRadius: 9, callbacks: { label(ctx) { const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : `${ctx.label}: `; return `${label}${formatMoney(ctx.raw)}`; } } }
    };
  }

  function updateStatistics() {
    const active = Array.isArray(branches) ? branches.length : 0;
    const submitted = new Set(reports.map((r) => r.branch_id).filter(Boolean)).size;
    const coverage = active ? Math.round((submitted / active) * 100) : 0;
    const matched = reports.filter((r) => { const v = verificationFor(r); return r.status === 'matched' || (v && Math.abs(Number(v.difference || 0)) < .005); }).length;
    const matchedRate = reports.length ? Math.round((matched / reports.length) * 100) : 0;
    const reported = reports.reduce((sum, r) => sum + Number(r.reported_total || paymentTotal(r)), 0);
    const customers = reports.reduce((sum, r) => sum + Number(r.customer_count || 0), 0);
    const pending = reports.filter((r) => !verificationFor(r)).length;
    const different = reports.filter((r) => { const v = verificationFor(r); return v && Math.abs(Number(v.difference || 0)) >= .005; }).length;
    const attention = pending + different;

    byId('statCoverage').textContent = `${coverage}%`;
    byId('statCoverageNote').textContent = `${submitted} of ${active} active branches`;
    byId('statMatched').textContent = matched.toLocaleString('en-PH');
    byId('statMatchedNote').textContent = `${matchedRate}% of submissions`;
    byId('statAverage').textContent = formatMoney(customers ? reported / customers : 0);
    byId('statAttention').textContent = attention.toLocaleString('en-PH');
    byId('statAttentionNote').textContent = `${pending} pending · ${different} with difference`;
    byId('statCoverageCard')?.classList.toggle('success', coverage === 100 && active > 0);
    byId('statMatchedCard')?.classList.toggle('success', matched > 0 && different === 0);
    byId('statAttentionCard')?.classList.toggle('alert', attention > 0);
    byId('statAttentionCard')?.classList.toggle('success', attention === 0 && reports.length > 0);
  }

  function renderBranchChart() {
    const rows = reports.map((r) => { const v = verificationFor(r); return { name: r.branches?.name || r.branches?.code || 'Unknown', reported: Number(r.reported_total || paymentTotal(r)), actual: v ? Number(v.actual_received || 0) : null }; }).sort((a, b) => b.reported - a.reported);
    empty('branchChartEmpty', !rows.length);
    if (!rows.length || !window.Chart) return;
    const frame = byId('branchChartFrame');
    if (frame) frame.style.height = `${Math.max(270, Math.min(540, 105 + rows.length * 38))}px`;
    replaceChart('branch', 'branchChart', {
      type: 'bar',
      data: { labels: rows.map((r) => r.name), datasets: [
        { label: 'Reported Total', data: rows.map((r) => r.reported), backgroundColor: 'rgba(18,104,232,.82)', borderColor: '#1268e8', borderWidth: 1, borderRadius: 6, borderSkipped: false },
        { label: 'Actual Received', data: rows.map((r) => r.actual), backgroundColor: 'rgba(19,138,69,.76)', borderColor: '#138a45', borderWidth: 1, borderRadius: 6, borderSkipped: false }
      ] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: plugins(), scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(117,133,153,.12)' }, border: { display: false }, ticks: { color: '#718096', font: { family: 'Inter', size: 9 }, callback: (value) => `₱${compact.format(value)}` } },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: '#445268', autoSkip: false, font: { family: 'Inter', size: 10, weight: '600' } } }
      } }
    });
  }

  function renderPaymentChart() {
    const rows = PAYMENT_TYPES.map(({ label, key }) => ({ label, value: reports.reduce((sum, r) => sum + Number(r[key] || 0), 0) })).filter((row) => row.value > 0);
    empty('paymentMixEmpty', !rows.length);
    if (!rows.length || !window.Chart) return;
    replaceChart('payment', 'paymentMixChart', {
      type: 'doughnut',
      data: { labels: rows.map((r) => r.label), datasets: [{ data: rows.map((r) => r.value), backgroundColor: ['#1268e8','#18a46b','#7259d9','#e9a23b','#37a5c9','#d35d6e','#6b7d91','#9e7a4c'], borderColor: '#fff', borderWidth: 3, hoverOffset: 5 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { ...plugins(), legend: { position: 'bottom', labels: plugins().legend.labels }, tooltip: { ...plugins().tooltip, callbacks: { label(ctx) { const total = ctx.dataset.data.reduce((sum, value) => sum + Number(value || 0), 0); const pct = total ? Number(ctx.raw) / total * 100 : 0; return `${ctx.label}: ${formatMoney(ctx.raw)} (${pct.toFixed(1)}%)`; } } } } }
    });
  }

  function renderStatusChart() {
    const values = { Matched: 0, Pending: 0, 'With Difference': 0, Draft: 0 };
    reports.forEach((r) => { const v = verificationFor(r); if (!v && r.status === 'draft') values.Draft += 1; else if (!v) values.Pending += 1; else if (Math.abs(Number(v.difference || 0)) < .005) values.Matched += 1; else values['With Difference'] += 1; });
    const rows = Object.entries(values).map(([label, value]) => ({ label, value })).filter((row) => row.value > 0);
    empty('statusChartEmpty', !rows.length);
    if (!rows.length || !window.Chart) return;
    replaceChart('status', 'statusChart', {
      type: 'doughnut',
      data: { labels: rows.map((r) => r.label), datasets: [{ data: rows.map((r) => r.value), backgroundColor: rows.map((r) => ({ Matched: '#138a45', Pending: '#e9a23b', 'With Difference': '#b42318', Draft: '#718096' })[r.label]), borderColor: '#fff', borderWidth: 3, hoverOffset: 5 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '66%', plugins: { legend: { position: 'bottom', labels: plugins().legend.labels }, tooltip: { ...plugins().tooltip, callbacks: { label(ctx) { return `${ctx.label}: ${Number(ctx.raw).toLocaleString('en-PH')} report${Number(ctx.raw) === 1 ? '' : 's'}`; } } } } }
    });
  }

  function renderAnalytics() {
    addSection();
    updateStatistics();
    if (!window.Chart) {
      ['branchChartEmpty','paymentMixEmpty','statusChartEmpty'].forEach((id) => empty(id, true, 'Charts could not load. Refresh the page and check the internet connection.'));
      return;
    }
    renderBranchChart();
    renderPaymentChart();
    renderStatusChart();
  }

  addSection();
  if (typeof renderMetrics === 'function') {
    const original = renderMetrics;
    renderMetrics = function renderMetricsWithAnalytics() { original(); renderAnalytics(); };
  }

  window.setTimeout(() => {
    loadAnalyticsAssets().finally(renderAnalytics);
  }, 0);
})();
