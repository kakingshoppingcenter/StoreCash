'use strict';

(function installDashboardAnalytics() {
  const PAYMENT_COLORS = ['#1268e8', '#18a46b', '#7259d9', '#e9a23b', '#37a5c9', '#d35d6e', '#6b7d91', '#9e7a4c'];

  function loadAnalyticsStyles() {
    if (document.querySelector('link[data-ksc-dashboard-analytics]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './dashboard-analytics.css?v=20260730-0840';
    link.dataset.kscDashboardAnalytics = 'true';
    document.head.appendChild(link);
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
      <div class="analytics-grid analytics-grid-two">
        <article class="analytics-card trend-card compact-reconciliation-card">
          <div class="analytics-card-head"><div><h4>Branch Reconciliation</h4><p>Compact comparison of reported and verified amounts.</p></div><span class="analytics-tag">Compact View</span></div>
          <div class="recon-toolbar">
            <div class="recon-legend"><span><i class="legend-swatch reported"></i>Reported</span><span><i class="legend-swatch received"></i>Received</span></div>
            <small id="branchChartMeta">No submissions</small>
          </div>
          <div class="native-chart-frame compact-chart-frame">
            <div class="recon-table-head" aria-hidden="true"><span>Branch</span><span>Reported</span><span>Received</span><span>Result</span></div>
            <div id="branchBars" class="branch-bars compact-reconciliation"></div>
            <div id="branchChartEmpty" class="chart-empty hidden">No branch submissions are available for this date.</div>
          </div>
        </article>
        <article class="analytics-card payment-card">
          <div class="analytics-card-head"><div><h4>Payment Channel Mix</h4><p>Share of the total by payment method.</p></div><span class="analytics-tag">Payment Mix</span></div>
          <div class="donut-layout"><div id="paymentMixChart" class="native-donut" role="img" aria-label="Payment channel mix"><div class="donut-center"><strong id="paymentMixTotal">₱0.00</strong><span>Total</span></div></div><div id="paymentMixLegend" class="donut-legend"></div></div>
          <div id="paymentMixEmpty" class="chart-empty inline-empty hidden">No payment amounts have been reported for this date.</div>
        </article>
      </div>`;

    metrics.insertAdjacentElement('afterend', section);
  }

  function toggleEmpty(id, show) {
    document.getElementById(id)?.classList.toggle('hidden', !show);
  }

  function updateStatistics() {
    const active = Array.isArray(branches) ? branches.length : 0;
    const submitted = new Set(reports.map((report) => report.branch_id).filter(Boolean)).size;
    const coverage = active ? Math.round((submitted / active) * 100) : 0;
    const matched = reports.filter((report) => {
      const verification = verificationFor(report);
      return report.status === 'matched' || (verification && Math.abs(Number(verification.difference || 0)) < 0.005);
    }).length;
    const matchedRate = reports.length ? Math.round((matched / reports.length) * 100) : 0;
    const reported = reports.reduce((sum, report) => sum + Number(report.reported_total || paymentTotal(report)), 0);
    const customers = reports.reduce((sum, report) => sum + Number(report.customer_count || 0), 0);
    const pending = reports.filter((report) => !verificationFor(report)).length;
    const different = reports.filter((report) => {
      const verification = verificationFor(report);
      return verification && Math.abs(Number(verification.difference || 0)) >= 0.005;
    }).length;
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
    const container = byId('branchBars');
    const meta = byId('branchChartMeta');
    if (!container) return;

    const rows = reports
      .map((report) => {
        const verification = verificationFor(report);
        const reported = Number(report.reported_total || paymentTotal(report));
        const actual = verification ? Number(verification.actual_received || 0) : null;
        const difference = actual === null ? null : actual - reported;
        const status = actual === null ? 'pending' : Math.abs(difference) < 0.005 ? 'matched' : 'different';
        return {
          name: report.branches?.name || report.branches?.code || 'Unknown',
          reported,
          actual,
          difference,
          status
        };
      })
      .sort((left, right) => right.reported - left.reported);

    toggleEmpty('branchChartEmpty', !rows.length);
    if (!rows.length) {
      container.innerHTML = '';
      if (meta) meta.textContent = 'No submissions';
      return;
    }

    const pendingCount = rows.filter((row) => row.status === 'pending').length;
    const differentCount = rows.filter((row) => row.status === 'different').length;
    const matchedCount = rows.filter((row) => row.status === 'matched').length;
    if (meta) meta.textContent = `${rows.length} branches · ${matchedCount} matched · ${pendingCount} pending · ${differentCount} difference`;

    const maximum = Math.max(1, ...rows.flatMap((row) => [row.reported, row.actual || 0]));
    container.innerHTML = rows.map((row) => {
      const reportedWidth = Math.max(1.5, (row.reported / maximum) * 100);
      const actualWidth = row.actual === null ? 0 : Math.max(1.5, (row.actual / maximum) * 100);
      const resultLabel = row.status === 'pending' ? 'Pending' : row.status === 'matched' ? 'Matched' : 'Difference';
      const resultValue = row.status === 'pending' ? 'Awaiting verification' : row.status === 'matched' ? formatMoney(0) : formatMoney(row.difference);
      return `
        <div class="recon-row">
          <div class="recon-branch"><strong>${escapeHtml(row.name)}</strong><small>${row.status === 'pending' ? 'Not yet verified' : 'Verification complete'}</small></div>
          <div class="recon-amount reported-amount"><strong>${escapeHtml(formatMoney(row.reported))}</strong><span class="mini-track"><i class="mini-fill reported" style="width:${reportedWidth}%"></i></span></div>
          <div class="recon-amount received-amount ${row.actual === null ? 'is-pending' : ''}"><strong>${row.actual === null ? '—' : escapeHtml(formatMoney(row.actual))}</strong><span class="mini-track"><i class="mini-fill received" style="width:${actualWidth}%"></i></span></div>
          <div class="recon-result ${row.status}"><span>${escapeHtml(resultLabel)}</span><strong>${escapeHtml(resultValue)}</strong></div>
        </div>`;
    }).join('');
  }

  function renderDonut(chartId, legendId, rows, totalLabel, valueFormatter) {
    const chart = byId(chartId);
    const legend = byId(legendId);
    if (!chart || !legend) return;

    const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
    if (!total) {
      chart.style.background = '#edf1f6';
      legend.innerHTML = '';
      return;
    }

    let cursor = 0;
    const segments = rows.map((row) => {
      const start = cursor;
      cursor += (Number(row.value) / total) * 100;
      return `${row.color} ${start.toFixed(3)}% ${cursor.toFixed(3)}%`;
    });
    chart.style.background = `conic-gradient(${segments.join(',')})`;
    chart.setAttribute('aria-label', `${totalLabel}: ${rows.map((row) => `${row.label} ${row.value}`).join(', ')}`);
    legend.innerHTML = rows.map((row) => {
      const percentage = total ? (Number(row.value) / total) * 100 : 0;
      return `<div class="donut-legend-row"><span class="legend-dot" style="background:${row.color}"></span><span class="legend-label">${escapeHtml(row.label)}</span><strong>${escapeHtml(valueFormatter(row.value))}</strong><small>${percentage.toFixed(1)}%</small></div>`;
    }).join('');
  }

  function renderPaymentChart() {
    const rows = PAYMENT_TYPES
      .map(({ label, key }, index) => ({
        label,
        value: reports.reduce((sum, report) => sum + Number(report[key] || 0), 0),
        color: PAYMENT_COLORS[index % PAYMENT_COLORS.length]
      }))
      .filter((row) => row.value > 0);

    const total = rows.reduce((sum, row) => sum + row.value, 0);
    toggleEmpty('paymentMixEmpty', !rows.length);
    byId('paymentMixTotal').textContent = formatMoney(total);
    renderDonut('paymentMixChart', 'paymentMixLegend', rows, 'Payment channel mix', (value) => formatMoney(value));
  }

  function renderAnalytics() {
    addSection();
    updateStatistics();
    renderBranchChart();
    renderPaymentChart();
  }

  loadAnalyticsStyles();
  addSection();

  if (typeof renderMetrics === 'function') {
    const original = renderMetrics;
    renderMetrics = function renderMetricsWithAnalytics() {
      original();
      renderAnalytics();
    };
  }

  window.setTimeout(renderAnalytics, 0);
})();