'use strict';

const PAYMENT_TYPES = [
  { label: 'CASH', key: 'cash' },
  { label: 'G-CASH', key: 'gcash' },
  { label: 'MAYA', key: 'maya' },
  { label: 'CREDIT', key: 'credit' },
  { label: 'DEBIT', key: 'debit' },
  { label: 'CHEQUE', key: 'cheque' },
  { label: 'SALMON', key: 'salmon' },
  { label: 'OTHER', key: 'other' }
];

const ROLE_LABELS = {
  store_user: 'Store User',
  checker: 'Deposit Checker',
  executive: 'Executive Reviewer',
  admin: 'System Administrator'
};

const STATUS_LABELS = {
  draft: 'Draft',
  pending_verification: 'Pending Verification',
  matched: 'Matched',
  with_difference: 'With Difference',
  reopened: 'Reopened'
};

const STATUS_CLASSES = {
  draft: 'neutral',
  pending_verification: 'pending',
  matched: 'matched',
  with_difference: 'different',
  reopened: 'neutral'
};

const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const dateFormatter = new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const today = new Date().toISOString().slice(0, 10);
const byId = (id) => document.getElementById(id);

let db = null;
let session = null;
let profile = null;
let branches = [];
let reports = [];
let audits = [];
let selectedEntryReport = null;
let selectedCheckerReport = null;
let currentView = 'dashboard';
let loadingCount = 0;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMoney(value) { return currency.format(Number(value) || 0); }
function formatDate(value) { return value ? dateFormatter.format(new Date(`${value}T00:00:00`)) : '—'; }
function formatDateTime(value) { return value ? dateTimeFormatter.format(new Date(value)) : '—'; }

function setLoading(isLoading, message = 'Loading…') {
  loadingCount = Math.max(0, loadingCount + (isLoading ? 1 : -1));
  byId('loadingText').textContent = message;
  byId('loadingOverlay').classList.toggle('hidden', loadingCount === 0);
}

function showToast(message, type = 'normal') {
  const toast = byId('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.className = 'toast'; }, 3200);
}

function setConnection(connected, text) {
  byId('connectionDot').className = `dot ${connected ? 'online' : 'offline'}`;
  byId('connectionText').textContent = text;
}

function paymentTotal(source) { return PAYMENT_TYPES.reduce((sum, item) => sum + Number(source[item.key] || 0), 0); }
function verificationFor(report) {
  const value = report?.deposit_verifications;
  return Array.isArray(value) ? value[0] || null : value || null;
}
function statusLabel(status) { return STATUS_LABELS[status] || 'Unknown'; }
function statusBadge(status) { return `<span class="badge ${STATUS_CLASSES[status] || 'neutral'}">${escapeHtml(statusLabel(status))}</span>`; }

function buildPaymentFields() {
  byId('paymentFields').innerHTML = PAYMENT_TYPES.map(({ label, key }) => `<label>${label}<div class="money-input"><span>₱</span><input class="payment" id="p_${key}" type="number" min="0" max="999999999999.99" step="0.01" value="0" required /></div></label>`).join('');
  document.querySelectorAll('.payment').forEach((input) => input.addEventListener('input', updateEntryTotal));
}

function getEntryValues() {
  const values = {};
  PAYMENT_TYPES.forEach(({ key }) => { values[key] = Number(byId(`p_${key}`).value || 0); });
  return values;
}
function updateEntryTotal() { byId('reportedTotal').textContent = formatMoney(paymentTotal(getEntryValues())); }
function getInitials(name) { return String(name || 'KS').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function isStoreUser() { return profile?.role === 'store_user'; }
function canVerify() { return ['checker', 'admin'].includes(profile?.role); }
function canReviewAudit() { return ['executive', 'admin'].includes(profile?.role); }

function showAuth(message = '') {
  byId('authScreen').classList.remove('hidden');
  byId('appShell').classList.add('hidden');
  byId('authMessage').textContent = message;
}
function showApp() {
  byId('authScreen').classList.add('hidden');
  byId('appShell').classList.remove('hidden');
}

function applyRoleVisibility() {
  document.querySelectorAll('[data-roles]').forEach((element) => {
    const roles = element.dataset.roles.split(',');
    element.classList.toggle('hidden', !roles.includes(profile.role));
  });
  byId('profileName').textContent = profile.full_name;
  byId('profileRole').textContent = ROLE_LABELS[profile.role] || profile.role;
  byId('profileInitials').textContent = getInitials(profile.full_name);
  if (isStoreUser()) currentView = 'dashboard';
  setView(currentView);
}

function setView(view) {
  const navButton = document.querySelector(`.nav-item[data-view="${view}"]:not(.hidden)`) || document.querySelector('.nav-item:not(.hidden)');
  if (!navButton) return;
  currentView = navButton.dataset.view;
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button === navButton));
  document.querySelectorAll('[data-section]').forEach((section) => section.classList.add('view-hidden'));
  const viewSections = { dashboard: ['dashboard', 'reports', 'summary'], entry: ['entry'], checker: ['checker', 'reports'], reports: ['reports'], summary: ['summary', 'reports'], audit: ['audit'] };
  (viewSections[currentView] || []).forEach((sectionName) => document.querySelectorAll(`[data-section="${sectionName}"]`).forEach((section) => section.classList.remove('view-hidden')));
  const titleMap = { dashboard: 'Daily Operations Dashboard', entry: 'Daily Store Entry', checker: 'Deposit Verification', reports: 'Branch Reports', summary: 'Executive Summary', audit: 'Audit Trail' };
  byId('pageTitle').textContent = titleMap[currentView] || 'KakingStoreCash';
}

function populateBranchOptions() {
  const previousValue = byId('branch').value;
  const allowed = isStoreUser() ? branches.filter((branch) => branch.id === profile.branch_id) : branches;
  byId('branch').innerHTML = allowed.map((branch) => `<option value="${branch.id}">${escapeHtml(branch.name)}</option>`).join('');
  if (allowed.some((branch) => branch.id === previousValue)) byId('branch').value = previousValue;
  byId('branch').disabled = isStoreUser();
}
function reportLabel(report) { return `${report.branches?.name || 'Unknown Branch'} · ${formatDate(report.business_date)} · ${statusLabel(report.status)}`; }

function populateReportSelectors() {
  const checkerReports = reports.filter((report) => report.status !== 'draft');
  byId('checkerReportSelect').innerHTML = `<option value="">Select submitted report</option>${checkerReports.map((report) => `<option value="${report.id}">${escapeHtml(reportLabel(report))}</option>`).join('')}`;
  byId('summaryReportSelect').innerHTML = `<option value="">Select branch report</option>${reports.map((report) => `<option value="${report.id}">${escapeHtml(reportLabel(report))}</option>`).join('')}`;
  if (selectedCheckerReport && checkerReports.some((report) => report.id === selectedCheckerReport.id)) byId('checkerReportSelect').value = selectedCheckerReport.id;
  else { selectedCheckerReport = checkerReports[0] || null; byId('checkerReportSelect').value = selectedCheckerReport?.id || ''; }
  byId('summaryReportSelect').value = reports[0]?.id || '';
  loadCheckerReport();
  renderSummary(reports[0] || null);
}

function renderMetrics() {
  const reported = reports.reduce((sum, report) => sum + Number(report.reported_total || paymentTotal(report)), 0);
  const actual = reports.reduce((sum, report) => sum + Number(verificationFor(report)?.actual_received || 0), 0);
  const customers = reports.reduce((sum, report) => sum + Number(report.customer_count || 0), 0);
  const difference = reports.reduce((sum, report) => sum + Number(verificationFor(report)?.difference || 0), 0);
  byId('metricReported').textContent = formatMoney(reported);
  byId('metricActual').textContent = formatMoney(actual);
  byId('metricDifference').textContent = formatMoney(difference);
  byId('metricDifference').className = difference === 0 ? 'positive' : 'negative';
  byId('metricCustomers').textContent = customers.toLocaleString('en-PH');
}

function renderReports() {
  const query = byId('reportSearch').value.trim().toLowerCase();
  const filtered = reports.filter((report) => `${report.branches?.name || ''} ${report.business_date} ${statusLabel(report.status)}`.toLowerCase().includes(query));
  byId('reportRows').innerHTML = filtered.map((report) => {
    const verification = verificationFor(report);
    const difference = verification ? Number(verification.difference || 0) : null;
    return `<tr data-report-id="${report.id}"><td><strong>${escapeHtml(report.branches?.name || 'Unknown')}</strong></td><td>${escapeHtml(formatDate(report.business_date))}</td><td>${escapeHtml(formatMoney(report.reported_total))}</td><td>${verification ? escapeHtml(formatMoney(verification.actual_received)) : '—'}</td><td class="${difference === null ? '' : difference === 0 ? 'positive' : 'negative'}">${difference === null ? '—' : escapeHtml(formatMoney(difference))}</td><td>${Number(report.customer_count || 0).toLocaleString('en-PH')}</td><td>${statusBadge(report.status)}</td><td>${escapeHtml(formatDateTime(report.submitted_at || report.created_at))}</td></tr>`;
  }).join('') || '<tr><td colspan="8" class="empty-state">No reports found for the selected date.</td></tr>';
  document.querySelectorAll('#reportRows tr[data-report-id]').forEach((row) => row.addEventListener('click', () => {
    const report = reports.find((item) => item.id === row.dataset.reportId);
    if (!report) return;
    selectedCheckerReport = report;
    byId('checkerReportSelect').value = report.id;
    byId('summaryReportSelect').value = report.id;
    loadCheckerReport();
    renderSummary(report);
    showToast(`Selected ${report.branches?.name || 'branch'} report.`);
  }));
}

function renderSummary(report) {
  if (!report) { byId('executiveSummary').innerHTML = '<div class="empty-state">Select a branch report to view its complete payment breakdown.</div>'; return; }
  const verification = verificationFor(report);
  const rows = PAYMENT_TYPES.map(({ label, key }) => `<div class="summary-row"><span>${label}</span><strong>${escapeHtml(formatMoney(report[key]))}</strong></div>`).join('');
  byId('executiveSummary').innerHTML = `<div class="summary-title">${escapeHtml(report.branches?.name || 'Unknown Branch')} · ${escapeHtml(formatDate(report.business_date))}</div>${rows}<div class="summary-row total"><span>IN TOTAL</span><strong>${escapeHtml(formatMoney(report.reported_total))}</strong></div><div class="summary-row"><span>Reading</span><strong>${verification ? escapeHtml(formatMoney(verification.reading)) : '—'}</strong></div><div class="summary-row"><span>Actual Received</span><strong>${verification ? escapeHtml(formatMoney(verification.actual_received)) : '—'}</strong></div><div class="summary-row"><span>Difference</span><strong class="${verification && Number(verification.difference) !== 0 ? 'negative' : 'positive'}">${verification ? escapeHtml(formatMoney(verification.difference)) : '—'}</strong></div><div class="summary-row"><span>Customers</span><strong>${Number(report.customer_count || 0).toLocaleString('en-PH')}</strong></div><div class="summary-row"><span>Status</span><strong>${statusLabel(report.status)}</strong></div>`;
}

function renderAudits() {
  if (!canReviewAudit()) { byId('auditRows').innerHTML = '<tr><td colspan="5" class="empty-state">Audit access is restricted.</td></tr>'; return; }
  byId('auditRows').innerHTML = audits.map((audit) => `<tr><td>${escapeHtml(formatDateTime(audit.created_at))}</td><td>${escapeHtml(audit.actor_name || 'System')}</td><td>${escapeHtml(audit.action)}</td><td>${escapeHtml(audit.entity_type)}</td><td><code>${escapeHtml(audit.entity_id || '—')}</code></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No audit records found.</td></tr>';
}

function setEntryLocked(locked) {
  document.querySelectorAll('#entryForm input, #entryForm select, #entryForm textarea').forEach((element) => { if (!['businessDate', 'branch'].includes(element.id)) element.disabled = locked; });
  byId('saveDraftBtn').disabled = locked;
  byId('submitReportBtn').disabled = locked;
  byId('clearEntryBtn').disabled = locked;
  byId('entryLockMessage').classList.toggle('hidden', !locked);
}
function clearEntryForm() {
  selectedEntryReport = null;
  PAYMENT_TYPES.forEach(({ key }) => { byId(`p_${key}`).value = '0'; });
  byId('customers').value = '0';
  byId('storeRemarks').value = '';
  byId('entryStatus').textContent = 'New Report';
  byId('entryStatus').className = 'badge neutral';
  setEntryLocked(false);
  updateEntryTotal();
}
function loadEntryReport() {
  selectedEntryReport = reports.find((report) => report.branch_id === byId('branch').value && report.business_date === byId('businessDate').value) || null;
  if (!selectedEntryReport) { clearEntryForm(); return; }
  PAYMENT_TYPES.forEach(({ key }) => { byId(`p_${key}`).value = selectedEntryReport[key] || 0; });
  byId('customers').value = selectedEntryReport.customer_count || 0;
  byId('storeRemarks').value = selectedEntryReport.store_remarks || '';
  byId('entryStatus').textContent = statusLabel(selectedEntryReport.status);
  byId('entryStatus').className = `badge ${STATUS_CLASSES[selectedEntryReport.status] || 'neutral'}`;
  setEntryLocked(!['draft', 'reopened'].includes(selectedEntryReport.status));
  updateEntryTotal();
}

function loadCheckerReport() {
  selectedCheckerReport = reports.find((report) => report.id === byId('checkerReportSelect').value) || null;
  const verification = verificationFor(selectedCheckerReport);
  byId('checkerReportLabel').textContent = selectedCheckerReport ? `${selectedCheckerReport.branches?.name || 'Unknown'} · ${formatDate(selectedCheckerReport.business_date)}` : 'No report selected';
  byId('checkerReported').textContent = formatMoney(selectedCheckerReport?.reported_total || 0);
  byId('actualReceived').value = verification?.actual_received ?? 0;
  byId('reading').value = verification?.reading ?? 0;
  byId('checkerRemarks').value = verification?.remarks ?? '';
  byId('receivedBy').value = profile?.full_name || '';
  updateCheckerDifference();
  const disabled = !canVerify() || !selectedCheckerReport;
  ['actualReceived', 'reading', 'checkerRemarks', 'verifyBtn'].forEach((idValue) => { byId(idValue).disabled = disabled; });
}
function updateCheckerDifference() {
  const actual = Number(byId('actualReceived').value || 0);
  const difference = actual - Number(selectedCheckerReport?.reported_total || 0);
  byId('difference').textContent = formatMoney(difference);
  byId('difference').className = difference === 0 ? 'positive' : 'negative';
  let label = 'Select Report', className = 'pending';
  if (selectedCheckerReport) {
    if (!actual && !verificationFor(selectedCheckerReport)) label = 'Pending';
    else if (difference === 0) { label = 'Matched'; className = 'matched'; }
    else { label = 'With Difference'; className = 'different'; }
  }
  byId('checkerStatus').textContent = label;
  byId('checkerStatus').className = `badge ${className}`;
}

function entryPayload(status) {
  return { branch_id: byId('branch').value, business_date: byId('businessDate').value, ...getEntryValues(), customer_count: Number(byId('customers').value || 0), store_remarks: byId('storeRemarks').value.trim() || null, status, submitted_by: session.user.id, submitted_at: status === 'pending_verification' ? new Date().toISOString() : selectedEntryReport?.submitted_at || null };
}
function validateEntry() {
  if (!byId('branch').value || !byId('businessDate').value) return 'Branch and business date are required.';
  if (!Number.isInteger(Number(byId('customers').value)) || Number(byId('customers').value) < 0) return 'Customer count must be a non-negative whole number.';
  if (PAYMENT_TYPES.some(({ key }) => Number(byId(`p_${key}`).value) < 0 || !Number.isFinite(Number(byId(`p_${key}`).value)))) return 'Payment amounts must be valid non-negative numbers.';
  return '';
}

async function saveEntry(status) {
  const validationMessage = validateEntry();
  if (validationMessage) return showToast(validationMessage, 'error');
  setLoading(true, status === 'draft' ? 'Saving draft…' : 'Submitting report…');
  try {
    const payload = entryPayload(status);
    const query = selectedEntryReport ? db.from('daily_reports').update(payload).eq('id', selectedEntryReport.id) : db.from('daily_reports').insert(payload);
    const { error } = await query;
    if (error) throw error;
    showToast(status === 'draft' ? 'Draft saved securely.' : 'Daily report submitted successfully.', 'success');
    await loadData();
    loadEntryReport();
  } catch (error) { console.error(error); showToast(error.message || 'Unable to save the report.', 'error'); }
  finally { setLoading(false); }
}

async function saveVerification() {
  if (!selectedCheckerReport) return showToast('Select a submitted report first.', 'error');
  const actual = Number(byId('actualReceived').value || 0), reading = Number(byId('reading').value || 0), difference = actual - Number(selectedCheckerReport.reported_total || 0), remarks = byId('checkerRemarks').value.trim();
  if (actual < 0 || reading < 0) return showToast('Actual received and reading cannot be negative.', 'error');
  if (difference !== 0 && !remarks) return showToast('Verification remarks are required when there is a difference.', 'error');
  setLoading(true, 'Saving verification…');
  try {
    const { error } = await db.from('deposit_verifications').upsert({ report_id: selectedCheckerReport.id, actual_received: actual, reading, remarks: remarks || null, verified_by: session.user.id, verified_at: new Date().toISOString() }, { onConflict: 'report_id' });
    if (error) throw error;
    showToast('Deposit verification saved successfully.', 'success');
    await loadData();
  } catch (error) { console.error(error); showToast(error.message || 'Unable to save verification.', 'error'); }
  finally { setLoading(false); }
}

async function loadProfile() {
  const { data, error } = await db.from('profiles').select('id,full_name,role,branch_id,active').eq('id', session.user.id).single();
  if (error) throw error;
  if (!data.active) throw new Error('Your account is not active. Contact the system administrator.');
  profile = data;
}

async function loadData() {
  setLoading(true, 'Loading branch reports…');
  try {
    const reportDate = byId('filterDate').value || today;
    const [branchResult, reportResult] = await Promise.all([
      db.from('branches').select('id,code,name,active').eq('active', true).order('name'),
      db.from('daily_reports').select('*,branches(id,code,name),deposit_verifications(id,actual_received,reading,difference,remarks,verified_by,verified_at)').eq('business_date', reportDate).order('created_at', { ascending: false })
    ]);
    if (branchResult.error) throw branchResult.error;
    if (reportResult.error) throw reportResult.error;
    branches = branchResult.data || [];
    reports = reportResult.data || [];
    if (canReviewAudit()) {
      const { data, error } = await db.from('audit_logs').select('id,actor_id,actor_name,action,entity_type,entity_id,created_at').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      audits = data || [];
    } else audits = [];
    populateBranchOptions();
    renderMetrics();
    renderReports();
    populateReportSelectors();
    renderAudits();
    loadEntryReport();
    setConnection(true, 'Connected securely to Supabase');
    byId('setupNotice').classList.add('hidden');
  } catch (error) {
    console.error(error);
    setConnection(false, 'Supabase setup or connection error');
    if (/relation .* does not exist|Could not find the table|schema cache/i.test(error.message || '')) byId('setupNotice').classList.remove('hidden');
    showToast(error.message || 'Unable to load system data.', 'error');
  } finally { setLoading(false); }
}

async function startApplication(currentSession) {
  session = currentSession;
  if (!session) { profile = null; reports = []; showAuth(); return; }
  setLoading(true, 'Authorizing account…');
  try { await loadProfile(); applyRoleVisibility(); showApp(); await loadData(); }
  catch (error) { console.error(error); await db.auth.signOut(); showAuth(error.message || 'Your account is not authorized for this system.'); }
  finally { setLoading(false); }
}

async function signIn(event) {
  event.preventDefault();
  byId('authMessage').textContent = '';
  byId('loginBtn').disabled = true;
  byId('loginBtn').textContent = 'Signing In…';
  try {
    const { data, error } = await db.auth.signInWithPassword({ email: byId('loginEmail').value.trim(), password: byId('loginPassword').value });
    if (error) throw error;
    await startApplication(data.session);
  } catch (error) { byId('authMessage').textContent = error.message || 'Sign-in failed.'; }
  finally { byId('loginBtn').disabled = false; byId('loginBtn').textContent = 'Sign In'; }
}
async function signOut() {
  setLoading(true, 'Signing out…');
  try { await db.auth.signOut(); showAuth('You have signed out successfully.'); }
  finally { setLoading(false); }
}

function exportCsv() {
  if (!reports.length) return showToast('There are no reports to export.', 'error');
  const headers = ['Branch', 'Date', ...PAYMENT_TYPES.map((item) => item.label), 'Reported Total', 'Actual Received', 'Reading', 'Difference', 'Customers', 'Status', 'Store Remarks', 'Verification Remarks'];
  const rows = reports.map((report) => {
    const verification = verificationFor(report);
    return [report.branches?.name || '', report.business_date, ...PAYMENT_TYPES.map(({ key }) => report[key] || 0), report.reported_total || 0, verification?.actual_received || '', verification?.reading || '', verification?.difference ?? '', report.customer_count || 0, statusLabel(report.status), report.store_remarks || '', verification?.remarks || ''];
  });
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join(String.fromCharCode(10));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `KakingStoreCash-${byId('filterDate').value || today}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function bindEvents() {
  byId('loginForm').addEventListener('submit', signIn);
  byId('logoutBtn').addEventListener('click', signOut);
  byId('refreshBtn').addEventListener('click', loadData);
  byId('exportBtn').addEventListener('click', exportCsv);
  byId('filterDate').addEventListener('change', async () => { byId('businessDate').value = byId('filterDate').value; await loadData(); });
  byId('reportSearch').addEventListener('input', renderReports);
  byId('businessDate').addEventListener('change', async () => { byId('filterDate').value = byId('businessDate').value; await loadData(); });
  byId('branch').addEventListener('change', loadEntryReport);
  byId('clearEntryBtn').addEventListener('click', clearEntryForm);
  byId('saveDraftBtn').addEventListener('click', () => saveEntry('draft'));
  byId('entryForm').addEventListener('submit', (event) => { event.preventDefault(); saveEntry('pending_verification'); });
  byId('checkerReportSelect').addEventListener('change', loadCheckerReport);
  byId('actualReceived').addEventListener('input', updateCheckerDifference);
  byId('verifyBtn').addEventListener('click', saveVerification);
  byId('summaryReportSelect').addEventListener('change', () => renderSummary(reports.find((report) => report.id === byId('summaryReportSelect').value) || null));
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
}

async function initialize() {
  buildPaymentFields();
  bindEvents();
  byId('businessDate').value = today;
  byId('filterDate').value = today;
  byId('todayLabel').textContent = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const config = window.KSC_CONFIG;
  if (!window.supabase?.createClient || !config?.supabaseUrl || !config?.supabasePublishableKey) { showAuth('Supabase configuration is missing. Contact the system administrator.'); return; }
  db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const { data: { session: currentSession } } = await db.auth.getSession();
  await startApplication(currentSession);
  db.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') showAuth(); });
}

initialize().catch((error) => { console.error(error); showAuth('The application could not start. Contact the system administrator.'); });
