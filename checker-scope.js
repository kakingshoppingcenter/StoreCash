'use strict';

(function installDepositCheckerScope() {
  const PAYMENT_SCOPE_FIELDS = [
    { key: 'cash', label: 'CASH' },
    { key: 'gcash', label: 'G-CASH' },
    { key: 'maya', label: 'MAYA' },
    { key: 'credit', label: 'CREDIT' },
    { key: 'debit', label: 'DEBIT' },
    { key: 'cheque', label: 'CHEQUE' },
    { key: 'salmon', label: 'SALMON' },
    { key: 'other', label: 'OTHER' }
  ];
  const PAYMENT_SCOPE_KEYS = PAYMENT_SCOPE_FIELDS.map((field) => field.key);
  const FULL_SCOPE = Object.freeze({ all: true, payment_types: [...PAYMENT_SCOPE_KEYS] });
  const MONEY_LIMIT = 999999999999.99;
  let baseLoadProfile = typeof loadProfile === 'function' ? loadProfile : null;
  let baseLoadData = typeof loadData === 'function' ? loadData : null;
  let baseRenderMetrics = typeof renderMetrics === 'function' ? renderMetrics : null;
  let baseRenderReports = typeof renderReports === 'function' ? renderReports : null;
  let baseRenderSummary = typeof renderSummary === 'function' ? renderSummary : null;
  let baseEditUser = typeof editUser === 'function' ? editUser : null;
  let baseResetUserForm = typeof resetUserForm === 'function' ? resetUserForm : null;

  function fullScope() {
    return { all: true, payment_types: [...PAYMENT_SCOPE_KEYS] };
  }

  function normalizeScope(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fullScope();
    if (value.all !== false) return fullScope();
    const selected = PAYMENT_SCOPE_KEYS.filter((key) => Array.isArray(value.payment_types) && value.payment_types.includes(key));
    return selected.length ? { all: false, payment_types: selected } : fullScope();
  }

  function activeScope(report = null) {
    return normalizeScope(report?.checker_scope || profile?.checker_scope || FULL_SCOPE);
  }

  function isDepositChecker() {
    return profile?.role === 'checker';
  }

  function scopeLabels(scope) {
    const selected = normalizeScope(scope).payment_types;
    return PAYMENT_SCOPE_FIELDS.filter((field) => selected.includes(field.key));
  }

  function arraysMatch(left, right) {
    const a = [...(left || [])].sort();
    const b = [...(right || [])].sort();
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  function roundMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.round((number + Number.EPSILON) * 100) / 100;
  }

  function installStyles() {
    if (document.getElementById('checkerScopeStyles')) return;
    const style = document.createElement('style');
    style.id = 'checkerScopeStyles';
    style.textContent = `
      .checker-scope-editor{display:none;margin:15px 0;padding:16px;border:1px solid #cfdced;border-radius:14px;background:#f8fbff}
      .checker-scope-editor.visible{display:block}.checker-scope-editor h4{margin:0;color:#22324a;font-size:13px}.checker-scope-editor p{margin:5px 0 0;color:#66758a;font-size:11px;line-height:1.5}
      .checker-scope-all{display:flex;align-items:flex-start;gap:10px;margin:14px 0 11px;padding:12px;border:1px solid #bfd3ec;border-radius:11px;background:#fff;color:#25364e;font-size:12px;font-weight:750;line-height:1.45}
      .checker-scope-all input,.checker-scope-option input{width:18px;height:18px;margin:0;accent-color:#1268e8}
      .checker-scope-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
      .checker-scope-option{display:flex;align-items:center;gap:8px;min-height:42px;padding:9px 10px;border:1px solid #dce5ef;border-radius:10px;background:#fff;color:#34445b;font-size:11px;font-weight:700}
      .checker-scope-option.disabled{opacity:.55;background:#f3f6f9}.checker-scope-message{min-height:17px;margin:9px 0 0!important;color:#b42318!important}
      .checker-authorized-panel{grid-column:1/-1;padding:14px;border:1px solid #cfe0f5;border-radius:13px;background:#f6f9fe}
      .checker-authorized-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:11px}.checker-authorized-head strong{color:#24364f;font-size:12px}.checker-authorized-head span{color:#68778c;font-size:10px;text-align:right}
      .checker-scope-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:11px}.checker-scope-chip{padding:5px 8px;border:1px solid #c6d9ef;border-radius:999px;background:#fff;color:#225d9f;font-size:9px;font-weight:850;letter-spacing:.03em}
      .checker-scope-values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.checker-scope-value{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border:1px solid #dde6f0;border-radius:9px;background:#fff}.checker-scope-value span{color:#65748a;font-size:10px}.checker-scope-value strong{color:#17243a;font-size:12px}
      .checker-scope-notice{grid-column:1/-1;padding:10px 12px;border:1px solid #ead8a8;border-radius:10px;background:#fff9e9;color:#6e5410;font-size:10px;line-height:1.5}
      .checker-scope-mismatch{grid-column:1/-1;padding:10px 12px;border:1px solid #f1c5c1;border-radius:10px;background:#fff7f6;color:#8c2b22;font-size:10px;line-height:1.5}
      @media(max-width:900px){.checker-scope-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.checker-scope-grid,.checker-scope-values{grid-template-columns:1fr}.checker-authorized-head{display:grid}.checker-authorized-head span{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function ensureScopeEditor() {
    const form = document.getElementById('userAdminForm');
    if (!form) return null;
    let editor = document.getElementById('checkerScopeEditor');
    if (editor) return editor;

    editor = document.createElement('section');
    editor.id = 'checkerScopeEditor';
    editor.className = 'checker-scope-editor';
    editor.innerHTML = `
      <h4>Deposit Checker Scope</h4>
      <p>Select exactly which store-entry payment fields this checker is authorized to view and reconcile.</p>
      <label class="checker-scope-all"><input id="checkerScopeAll" type="checkbox" checked /><span><strong>Check all store-entry payment types</strong><br><small>The checker may view the complete payment breakdown, customer count, and store remarks.</small></span></label>
      <div class="checker-scope-grid">
        ${PAYMENT_SCOPE_FIELDS.map((field) => `<label class="checker-scope-option disabled"><input type="checkbox" data-checker-scope-key="${field.key}" checked disabled /><span>${field.label}</span></label>`).join('')}
      </div>
      <p id="checkerScopeMessage" class="checker-scope-message" aria-live="polite"></p>`;

    const warning = form.querySelector('.admin-warning');
    if (warning) warning.insertAdjacentElement('afterend', editor);
    else form.querySelector('.admin-actions')?.insertAdjacentElement('beforebegin', editor);

    const allControl = editor.querySelector('#checkerScopeAll');
    allControl.addEventListener('change', syncScopeControls);
    editor.querySelectorAll('[data-checker-scope-key]').forEach((input) => input.addEventListener('change', validateScopeEditor));
    syncScopeControls();
    return editor;
  }

  function syncScopeControls() {
    const editor = ensureScopeEditor();
    if (!editor) return;
    const all = editor.querySelector('#checkerScopeAll').checked;
    editor.querySelectorAll('[data-checker-scope-key]').forEach((input) => {
      input.disabled = all;
      if (all) input.checked = true;
      input.closest('.checker-scope-option')?.classList.toggle('disabled', all);
    });
    validateScopeEditor();
  }

  function validateScopeEditor() {
    const editor = ensureScopeEditor();
    if (!editor) return true;
    const all = editor.querySelector('#checkerScopeAll').checked;
    const selected = [...editor.querySelectorAll('[data-checker-scope-key]:checked')];
    const valid = all || selected.length > 0;
    editor.querySelector('#checkerScopeMessage').textContent = valid ? '' : 'Select at least one payment type for this Deposit Checker.';
    return valid;
  }

  function selectedEditorScope() {
    const editor = ensureScopeEditor();
    if (!editor || editor.querySelector('#checkerScopeAll').checked) return fullScope();
    const selected = [...editor.querySelectorAll('[data-checker-scope-key]:checked')].map((input) => input.dataset.checkerScopeKey);
    if (!selected.length) throw new Error('Select at least one payment type for the Deposit Checker.');
    return { all: false, payment_types: PAYMENT_SCOPE_KEYS.filter((key) => selected.includes(key)) };
  }

  function applyScopeEditor(value) {
    const editor = ensureScopeEditor();
    if (!editor) return;
    const scope = normalizeScope(value);
    editor.querySelector('#checkerScopeAll').checked = scope.all;
    editor.querySelectorAll('[data-checker-scope-key]').forEach((input) => {
      input.checked = scope.all || scope.payment_types.includes(input.dataset.checkerScopeKey);
    });
    syncScopeControls();
  }

  function syncScopeEditorVisibility() {
    const editor = ensureScopeEditor();
    if (!editor) return;
    const checkerRole = document.getElementById('userRole')?.value === 'checker';
    editor.classList.toggle('visible', checkerRole);
    if (!checkerRole) applyScopeEditor(FULL_SCOPE);
  }

  function installAdministrationHooks() {
    ensureScopeEditor();
    const roleSelect = document.getElementById('userRole');
    if (roleSelect && !roleSelect.dataset.checkerScopeBound) {
      roleSelect.dataset.checkerScopeBound = 'true';
      roleSelect.addEventListener('change', syncScopeEditorVisibility);
    }

    const resetButton = document.getElementById('userResetBtn');
    if (resetButton && !resetButton.dataset.checkerScopeBound) {
      resetButton.dataset.checkerScopeBound = 'true';
      resetButton.addEventListener('click', () => window.setTimeout(() => {
        applyScopeEditor(FULL_SCOPE);
        syncScopeEditorVisibility();
      }, 0));
    }

    if (baseEditUser && !editUser.__checkerScopeWrapped) {
      const wrappedEditUser = function checkerScopeEditUser(id) {
        baseEditUser(id);
        const user = Array.isArray(adminUsers) ? adminUsers.find((item) => item.id === id) : null;
        applyScopeEditor(user?.checker_scope || FULL_SCOPE);
        syncScopeEditorVisibility();
      };
      wrappedEditUser.__checkerScopeWrapped = true;
      editUser = wrappedEditUser;
    }

    if (baseResetUserForm && !resetUserForm.__checkerScopeWrapped) {
      const wrappedResetUserForm = function checkerScopeResetUserForm() {
        baseResetUserForm();
        applyScopeEditor(FULL_SCOPE);
        syncScopeEditorVisibility();
      };
      wrappedResetUserForm.__checkerScopeWrapped = true;
      resetUserForm = wrappedResetUserForm;
    }

    syncScopeEditorVisibility();
  }

  function installAdminRequestHook() {
    if (typeof invokeAdminUsers !== 'function' || invokeAdminUsers.__checkerScopeWrapped) return;
    const baseInvoke = invokeAdminUsers;
    const wrappedInvoke = async function checkerScopedAdminRequest(payload) {
      if (payload?.action === 'create_user' || payload?.action === 'update_user') {
        const role = payload.role || document.getElementById('userRole')?.value;
        const checkerScope = role === 'checker' ? selectedEditorScope() : fullScope();
        return baseInvoke({ ...payload, checker_scope: checkerScope });
      }
      return baseInvoke(payload);
    };
    wrappedInvoke.__checkerScopeWrapped = true;
    invokeAdminUsers = wrappedInvoke;
  }

  if (baseLoadProfile) {
    loadProfile = async function checkerScopedLoadProfile() {
      await baseLoadProfile();
      const result = await db.from('profiles').select('checker_scope').eq('id', session.user.id).maybeSingle();
      if (result.error) {
        if (profile?.role === 'checker') {
          throw new Error('Deposit Checker Scope is not installed. Run supabase/checker_scope_extension.sql before allowing checker access.');
        }
        profile.checker_scope = fullScope();
        return;
      }
      profile.checker_scope = normalizeScope(result.data?.checker_scope);
    };
  }

  function normalizeScopedReports(data) {
    return (Array.isArray(data) ? data : []).map((item) => {
      if (typeof item === 'string') {
        try { return JSON.parse(item); } catch (_) { return null; }
      }
      return item;
    }).filter(Boolean);
  }

  if (baseLoadData) {
    loadData = async function checkerScopedLoadData() {
      if (!isDepositChecker()) return baseLoadData();

      setLoading(true, 'Loading authorized deposit fields…');
      try {
        const reportDate = byId('filterDate').value || today;
        const [branchResult, reportResult] = await Promise.all([
          db.from('branches').select('id,code,name,active').eq('active', true).order('name'),
          db.rpc('get_scoped_daily_reports', { p_business_date: reportDate })
        ]);

        if (branchResult.error) throw branchResult.error;
        if (reportResult.error) throw reportResult.error;
        branches = branchResult.data || [];
        reports = normalizeScopedReports(reportResult.data);
        audits = [];
        populateBranchOptions();
        renderMetrics();
        renderReports();
        populateReportSelectors();
        renderAudits();
        updateCheckerPageLabels();
        setConnection(true, 'Connected with restricted Deposit Checker access');
        byId('setupNotice').classList.add('hidden');
      } catch (error) {
        console.error(error);
        setConnection(false, 'Deposit Checker Scope setup error');
        if (/get_scoped_daily_reports|checker_scope|schema cache|PGRST/i.test(error.message || '')) byId('setupNotice').classList.remove('hidden');
        showToast(error.message || 'Unable to load authorized checker data.', 'error');
      } finally {
        setLoading(false);
      }
    };
  }

  function updateCheckerPageLabels() {
    if (!isDepositChecker()) return;
    const reportedMetric = document.getElementById('metricReported')?.closest('article')?.querySelector('span');
    if (reportedMetric) reportedMetric.textContent = 'Authorized Total';
    const customersMetric = document.getElementById('metricCustomers')?.closest('article')?.querySelector('span');
    if (customersMetric) customersMetric.textContent = activeScope().all ? 'Customers' : 'Customer Data';
    const checkerReportedLabel = document.getElementById('checkerReported')?.parentElement?.querySelector('span');
    if (checkerReportedLabel) checkerReportedLabel.textContent = 'Authorized Expected Total';
  }

  if (baseRenderMetrics) {
    renderMetrics = function checkerScopedRenderMetrics() {
      if (!isDepositChecker()) return baseRenderMetrics();
      const expected = reports.reduce((sum, report) => sum + Number(report.reported_total || 0), 0);
      const actual = reports.reduce((sum, report) => sum + Number(verificationFor(report)?.actual_received || 0), 0);
      const differenceValue = reports.reduce((sum, report) => sum + Number(verificationFor(report)?.difference || 0), 0);
      byId('metricReported').textContent = formatMoney(expected);
      byId('metricActual').textContent = formatMoney(actual);
      byId('metricDifference').textContent = formatMoney(differenceValue);
      byId('metricDifference').className = differenceValue === 0 ? 'positive' : 'negative';
      byId('metricCustomers').textContent = activeScope().all
        ? reports.reduce((sum, report) => sum + Number(report.customer_count || 0), 0).toLocaleString('en-PH')
        : 'Restricted';
      updateCheckerPageLabels();
    };
  }

  if (baseRenderReports) {
    renderReports = function checkerScopedRenderReports() {
      if (!isDepositChecker()) return baseRenderReports();
      const query = byId('reportSearch').value.trim().toLowerCase();
      const filtered = reports.filter((report) => `${report.branches?.name || ''} ${report.business_date} ${statusLabel(report.status)}`.toLowerCase().includes(query));
      const headerCells = document.querySelectorAll('[data-section="reports"] thead th');
      if (headerCells[2]) headerCells[2].textContent = 'Authorized Total';
      if (headerCells[5]) headerCells[5].textContent = activeScope().all ? 'Customers' : 'Customer Data';

      byId('reportRows').innerHTML = filtered.map((report) => {
        const verification = verificationFor(report);
        const differenceValue = verification ? Number(verification.difference || 0) : null;
        const customers = report.customer_count == null ? 'Restricted' : Number(report.customer_count || 0).toLocaleString('en-PH');
        return `<tr data-report-id="${report.id}"><td><strong>${escapeHtml(report.branches?.name || 'Unknown')}</strong></td><td>${escapeHtml(formatDate(report.business_date))}</td><td>${escapeHtml(formatMoney(report.reported_total))}</td><td>${verification ? escapeHtml(formatMoney(verification.actual_received)) : '—'}</td><td class="${differenceValue === null ? '' : differenceValue === 0 ? 'positive' : 'negative'}">${differenceValue === null ? '—' : escapeHtml(formatMoney(differenceValue))}</td><td>${escapeHtml(customers)}</td><td>${statusBadge(report.status)}</td><td>${escapeHtml(formatDateTime(report.submitted_at || report.created_at))}</td></tr>`;
      }).join('') || '<tr><td colspan="8" class="empty-state">No authorized reports found for the selected date.</td></tr>';

      document.querySelectorAll('#reportRows tr[data-report-id]').forEach((row) => row.addEventListener('click', () => {
        const report = reports.find((item) => item.id === row.dataset.reportId);
        if (!report) return;
        selectedCheckerReport = report;
        byId('checkerReportSelect').value = report.id;
        byId('summaryReportSelect').value = report.id;
        loadCheckerReport();
        renderSummary(report);
        showToast(`Selected ${report.branches?.name || 'branch'} authorized deposit fields.`);
      }));
    };
  }

  if (baseRenderSummary) {
    renderSummary = function checkerScopedRenderSummary(report) {
      if (!isDepositChecker()) return baseRenderSummary(report);
      if (!report) {
        byId('executiveSummary').innerHTML = '<div class="empty-state">Select a branch report to view the payment fields authorized by Administration.</div>';
        return;
      }
      const scope = activeScope(report);
      const verification = verificationFor(report);
      const rows = scopeLabels(scope).map(({ label, key }) => `<div class="summary-row"><span>${label}</span><strong>${escapeHtml(formatMoney(report[key]))}</strong></div>`).join('');
      const restriction = scope.all ? '' : '<div class="checker-scope-notice">Unselected payment values, customer count, and store remarks are restricted by Administration.</div>';
      const customers = scope.all ? `<div class="summary-row"><span>Customers</span><strong>${Number(report.customer_count || 0).toLocaleString('en-PH')}</strong></div>` : '';
      byId('executiveSummary').innerHTML = `<div class="summary-title">${escapeHtml(report.branches?.name || 'Unknown Branch')} · ${escapeHtml(formatDate(report.business_date))}</div>${restriction}${rows}<div class="summary-row total"><span>AUTHORIZED TOTAL</span><strong>${escapeHtml(formatMoney(report.reported_total))}</strong></div><div class="summary-row"><span>Reading</span><strong>${verification ? escapeHtml(formatMoney(verification.reading)) : '—'}</strong></div><div class="summary-row"><span>Actual Received</span><strong>${verification ? escapeHtml(formatMoney(verification.actual_received)) : '—'}</strong></div><div class="summary-row"><span>Difference</span><strong class="${verification && Number(verification.difference) !== 0 ? 'negative' : 'positive'}">${verification ? escapeHtml(formatMoney(verification.difference)) : '—'}</strong></div>${customers}<div class="summary-row"><span>Status</span><strong>${statusLabel(report.status)}</strong></div>`;
    };
  }

  function ensureCheckerBreakdown() {
    const comparison = document.querySelector('.checker-card .comparison');
    if (!comparison) return null;
    let panel = document.getElementById('checkerAuthorizedFields');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'checkerAuthorizedFields';
    panel.className = 'checker-authorized-panel';
    const reportSelect = document.getElementById('checkerReportSelect')?.closest('label');
    if (reportSelect) reportSelect.insertAdjacentElement('afterend', panel);
    else comparison.prepend(panel);
    return panel;
  }

  function renderCheckerBreakdown(report) {
    const panel = ensureCheckerBreakdown();
    if (!panel) return;
    if (!report) {
      panel.innerHTML = '<div class="empty-state">Select a submitted report to view the authorized payment fields.</div>';
      return;
    }
    const scope = activeScope(report);
    const fields = scopeLabels(scope);
    const verification = verificationFor(report);
    const mismatch = verification?.checked_payment_types && !arraysMatch(verification.checked_payment_types, scope.payment_types)
      ? '<div class="checker-scope-mismatch">This report was previously verified using a different payment scope. Saving again will use your current authorized fields.</div>'
      : '';
    panel.innerHTML = `
      <div class="checker-authorized-head"><strong>Authorized Store Entry Fields</strong><span>${scope.all ? 'Complete store entry' : 'Restricted by Administration'}</span></div>
      <div class="checker-scope-chips">${fields.map((field) => `<span class="checker-scope-chip">${field.label}</span>`).join('')}</div>
      <div class="checker-scope-values">${fields.map((field) => `<div class="checker-scope-value"><span>${field.label}</span><strong>${escapeHtml(formatMoney(report[field.key]))}</strong></div>`).join('')}</div>
      ${scope.all ? '' : '<div class="checker-scope-notice">Only the payment fields above are included in the expected total and difference. Other store sales are not available to this account.</div>'}
      ${mismatch}`;
  }

  loadCheckerReport = function checkerScopedLoadCheckerReport() {
    selectedCheckerReport = reports.find((report) => report.id === byId('checkerReportSelect').value) || null;
    const verification = verificationFor(selectedCheckerReport);
    byId('checkerReportLabel').textContent = selectedCheckerReport ? `${selectedCheckerReport.branches?.name || 'Unknown'} · ${formatDate(selectedCheckerReport.business_date)}` : 'No report selected';
    byId('checkerReported').textContent = formatMoney(selectedCheckerReport?.reported_total || 0);
    byId('actualReceived').value = verification?.actual_received ?? 0;
    byId('reading').value = verification?.reading ?? 0;
    byId('checkerRemarks').value = verification?.remarks ?? '';
    byId('receivedBy').value = profile?.full_name || '';
    renderCheckerBreakdown(selectedCheckerReport);
    updateCheckerDifference();
    const disabled = !canVerify() || !selectedCheckerReport;
    ['actualReceived', 'reading', 'checkerRemarks', 'verifyBtn'].forEach((idValue) => { byId(idValue).disabled = disabled; });
    updateCheckerPageLabels();
  };

  function scopedCheckerDifference() {
    const actual = roundMoney(byId('actualReceived').value || 0);
    const expected = roundMoney(selectedCheckerReport?.reported_total || 0);
    const differenceValue = roundMoney(actual - expected);
    const verification = verificationFor(selectedCheckerReport);
    byId('difference').textContent = formatMoney(differenceValue);
    byId('difference').className = differenceValue === 0 ? 'positive' : 'negative';
    let label = 'Select Report';
    let className = 'pending';
    if (selectedCheckerReport) {
      if (!verification && actual === 0) label = 'Pending';
      else if (differenceValue === 0) { label = 'Matched'; className = 'matched'; }
      else { label = 'With Difference'; className = 'different'; }
    }
    byId('checkerStatus').textContent = label;
    byId('checkerStatus').className = `badge ${className}`;
  }

  async function scopedSaveVerification() {
    if (!selectedCheckerReport) return showToast('Select a submitted report first.', 'error');
    if (['draft', 'reopened'].includes(selectedCheckerReport.status)) return showToast('Only submitted reports can be verified.', 'error');
    const actualRaw = Number(byId('actualReceived').value);
    const readingRaw = Number(byId('reading').value);
    if (!Number.isFinite(actualRaw) || !Number.isFinite(readingRaw)) return showToast('Actual received and reading must be valid numbers.', 'error');
    if (actualRaw < 0 || readingRaw < 0 || actualRaw > MONEY_LIMIT || readingRaw > MONEY_LIMIT) return showToast('Actual received and reading must be within the allowed non-negative range.', 'error');
    const actual = roundMoney(actualRaw);
    const readingValue = roundMoney(readingRaw);
    const differenceValue = roundMoney(actual - Number(selectedCheckerReport.reported_total || 0));
    const remarks = byId('checkerRemarks').value.trim();
    if (differenceValue !== 0 && !remarks) return showToast('Verification remarks are required when there is a difference.', 'error');

    setLoading(true, 'Saving scoped deposit verification…');
    try {
      const { error } = await db.from('deposit_verifications').upsert({
        report_id: selectedCheckerReport.id,
        actual_received: actual,
        reading: readingValue,
        remarks: remarks || null,
        verified_by: session.user.id,
        verified_at: new Date().toISOString()
      }, { onConflict: 'report_id' });
      if (error) throw error;
      showToast('Authorized deposit verification saved successfully.', 'success');
      await loadData();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Unable to save the scoped verification.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function safeCsvCell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function scopedExportCsv() {
    if (!reports.length) return showToast('There are no reports to export.', 'error');
    const scope = isDepositChecker() ? activeScope() : fullScope();
    const exportFields = isDepositChecker() ? scopeLabels(scope) : PAYMENT_SCOPE_FIELDS;
    const headers = ['Branch', 'Date', ...exportFields.map((field) => field.label), isDepositChecker() ? 'Authorized Total' : 'Reported Total', 'Actual Received', 'Reading', 'Difference'];
    if (!isDepositChecker() || scope.all) headers.push('Customers');
    headers.push('Status');
    if (!isDepositChecker() || scope.all) headers.push('Store Remarks');
    headers.push('Verification Remarks');

    const rows = reports.map((report) => {
      const verification = verificationFor(report);
      const row = [report.branches?.name || '', report.business_date, ...exportFields.map(({ key }) => report[key] ?? ''), report.reported_total ?? 0, verification?.actual_received ?? '', verification?.reading ?? '', verification?.difference ?? ''];
      if (!isDepositChecker() || scope.all) row.push(report.customer_count ?? 0);
      row.push(statusLabel(report.status));
      if (!isDepositChecker() || scope.all) row.push(report.store_remarks || '');
      row.push(verification?.remarks || '');
      return row;
    });

    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(safeCsvCell).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `KakingStoreCash-${byId('filterDate').value || today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function replaceHandlerElement(id, eventName, handler, marker) {
    const current = document.getElementById(id);
    if (!current || current.dataset[marker] === 'true') return current;
    const replacement = current.cloneNode(true);
    replacement.dataset[marker] = 'true';
    current.replaceWith(replacement);
    replacement.addEventListener(eventName, handler);
    return replacement;
  }

  function installImmediateBindings() {
    replaceHandlerElement('refreshBtn', 'click', () => loadData(), 'checkerScopeRefresh');
    replaceHandlerElement('reportSearch', 'input', () => renderReports(), 'checkerScopeSearch');
    replaceHandlerElement('checkerReportSelect', 'change', () => loadCheckerReport(), 'checkerScopeSelect');
    byId('actualReceived')?.addEventListener('input', scopedCheckerDifference);
  }

  function installLateOverrides() {
    updateCheckerDifference = scopedCheckerDifference;
    saveVerification = scopedSaveVerification;
    exportCsv = scopedExportCsv;
    installAdminRequestHook();
    replaceHandlerElement('verifyBtn', 'click', scopedSaveVerification, 'checkerScopeVerify');
    replaceHandlerElement('exportBtn', 'click', scopedExportCsv, 'checkerScopeExport');
  }

  installStyles();
  installAdministrationHooks();
  installAdminRequestHook();
  installImmediateBindings();
  updateCheckerDifference = scopedCheckerDifference;
  saveVerification = scopedSaveVerification;
  exportCsv = scopedExportCsv;

  window.addEventListener('load', () => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      installAdministrationHooks();
      installLateOverrides();
      attempts += 1;
      if (attempts >= 24) window.clearInterval(timer);
    }, 250);
    window.setTimeout(() => {
      installLateOverrides();
      if (session && profile?.role === 'checker') loadData().catch((error) => console.error('Unable to refresh checker scope.', error));
    }, 100);
  }, { once: true });
})();
