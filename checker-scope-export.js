'use strict';

(function installDepositCheckerScopedExport() {
  const PAYMENT_FIELDS = [
    { key: 'cash', label: 'CASH' },
    { key: 'gcash', label: 'G-CASH' },
    { key: 'maya', label: 'MAYA' },
    { key: 'credit', label: 'CREDIT' },
    { key: 'debit', label: 'DEBIT' },
    { key: 'cheque', label: 'CHEQUE' },
    { key: 'salmon', label: 'SALMON' },
    { key: 'other', label: 'OTHER' }
  ];
  const originalButton = document.getElementById('exportBtn');
  if (!originalButton || originalButton.dataset.checkerScopedExport === 'true') return;

  function currentScope() {
    const value = profile?.checker_scope;
    if (!value || value.all !== false || !Array.isArray(value.payment_types)) {
      return { all: true, payment_types: PAYMENT_FIELDS.map((field) => field.key) };
    }
    const selected = PAYMENT_FIELDS.map((field) => field.key).filter((key) => value.payment_types.includes(key));
    return selected.length
      ? { all: false, payment_types: selected }
      : { all: true, payment_types: PAYMENT_FIELDS.map((field) => field.key) };
  }

  function safeCsvCell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportAuthorizedCsv() {
    if (!Array.isArray(reports) || !reports.length) {
      showToast('There are no authorized reports to export.', 'error');
      return;
    }

    const scope = currentScope();
    const fields = PAYMENT_FIELDS.filter((field) => scope.payment_types.includes(field.key));
    const headers = [
      'Branch',
      'Date',
      ...fields.map((field) => field.label),
      'Authorized Total',
      'Actual Received',
      'Reading',
      'Difference',
      ...(scope.all ? ['Customers'] : []),
      'Status',
      ...(scope.all ? ['Store Remarks'] : []),
      'Verification Remarks'
    ];

    const rows = reports.map((report) => {
      const verification = typeof verificationFor === 'function' ? verificationFor(report) : null;
      return [
        report.branches?.name || report.branches?.code || '',
        report.business_date || '',
        ...fields.map(({ key }) => report[key] ?? ''),
        report.reported_total ?? 0,
        verification?.actual_received ?? '',
        verification?.reading ?? '',
        verification?.difference ?? '',
        ...(scope.all ? [report.customer_count ?? 0] : []),
        typeof statusLabel === 'function' ? statusLabel(report.status) : String(report.status || ''),
        ...(scope.all ? [report.store_remarks || ''] : []),
        verification?.remarks || ''
      ];
    });

    const csv = `\uFEFF${[headers, ...rows]
      .map((row) => row.map(safeCsvCell).join(','))
      .join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `KakingStoreCash-Authorized-${document.getElementById('filterDate')?.value || new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast('Authorized Deposit Checker data exported successfully.', 'success');
  }

  const replacement = originalButton.cloneNode(true);
  replacement.dataset.checkerScopedExport = 'true';
  originalButton.replaceWith(replacement);

  replacement.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (profile?.role === 'checker') {
      exportAuthorizedCsv();
      return;
    }
    originalButton.click();
  }, { capture: true });

  function updateLabel() {
    if (profile?.role === 'checker') {
      replacement.textContent = 'Export Authorized CSV';
      replacement.title = 'Export only the payment fields authorized for this Deposit Checker';
    } else {
      replacement.textContent = 'Export Excel';
      replacement.title = 'Download the complete formatted Excel report';
    }
  }

  updateLabel();
  const observer = new MutationObserver(updateLabel);
  observer.observe(document.getElementById('profileRole') || document.body, {
    subtree: true,
    childList: true,
    characterData: true
  });
})();
