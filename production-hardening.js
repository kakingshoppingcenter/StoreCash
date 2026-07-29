'use strict';

(function installProductionHardening() {
  const MAX_MONEY = 999999999999.99;
  const MONEY_SCALE = 100;

  function roundMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.round((number + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;
  }

  function manilaDateISO(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function formatManilaLongDate(date = new Date()) {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  function normalizeMoneyInput(input) {
    if (!input) return;
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 0) return;
    input.value = String(roundMoney(Math.min(value, MAX_MONEY)));
  }

  function installLocalBusinessDate() {
    const localToday = manilaDateISO();
    const utcToday = new Date().toISOString().slice(0, 10);
    const filterDate = document.getElementById('filterDate');
    const businessDate = document.getElementById('businessDate');
    const todayLabel = document.getElementById('todayLabel');
    let changed = false;

    if (todayLabel) todayLabel.textContent = formatManilaLongDate();

    if (filterDate && (!filterDate.value || filterDate.value === utcToday)) {
      changed = filterDate.value !== localToday;
      filterDate.value = localToday;
    }
    if (businessDate && (!businessDate.value || businessDate.value === utcToday)) {
      changed = changed || businessDate.value !== localToday;
      businessDate.value = localToday;
    }

    if (changed) {
      window.setTimeout(() => {
        if (typeof session !== 'undefined' && session && typeof profile !== 'undefined' && profile && typeof loadData === 'function') {
          loadData().catch((error) => console.error('Unable to refresh the Manila business date.', error));
        }
      }, 700);
    }
  }

  const basePaymentTotal = typeof paymentTotal === 'function' ? paymentTotal : null;
  if (basePaymentTotal) {
    paymentTotal = function hardenedPaymentTotal(source) {
      return roundMoney(basePaymentTotal(source));
    };
  }

  const baseEntryPayload = typeof entryPayload === 'function' ? entryPayload : null;
  if (baseEntryPayload) {
    entryPayload = function hardenedEntryPayload(status) {
      const payload = baseEntryPayload(status);
      PAYMENT_TYPES.forEach(({ key }) => {
        payload[key] = roundMoney(payload[key]);
      });

      // The identity of the original submitter is a permanent financial audit field.
      if (selectedEntryReport?.submitted_by) {
        payload.submitted_by = selectedEntryReport.submitted_by;
      }

      return payload;
    };
  }

  updateCheckerDifference = function hardenedCheckerDifference() {
    const actual = roundMoney(byId('actualReceived').value || 0);
    const reported = roundMoney(selectedCheckerReport?.reported_total || 0);
    const differenceValue = roundMoney(actual - reported);
    const verification = verificationFor(selectedCheckerReport);

    byId('difference').textContent = formatMoney(differenceValue);
    byId('difference').className = differenceValue === 0 ? 'positive' : 'negative';

    let label = 'Select Report';
    let className = 'pending';
    if (selectedCheckerReport) {
      if (!verification && actual === 0) {
        label = 'Pending';
      } else if (differenceValue === 0) {
        label = 'Matched';
        className = 'matched';
      } else {
        label = 'With Difference';
        className = 'different';
      }
    }

    byId('checkerStatus').textContent = label;
    byId('checkerStatus').className = `badge ${className}`;
  };

  saveVerification = async function hardenedSaveVerification() {
    if (!selectedCheckerReport) return showToast('Select a submitted report first.', 'error');
    if (['draft', 'reopened'].includes(selectedCheckerReport.status)) {
      return showToast('Only submitted reports can be verified.', 'error');
    }

    const actualRaw = Number(byId('actualReceived').value);
    const readingRaw = Number(byId('reading').value);
    if (!Number.isFinite(actualRaw) || !Number.isFinite(readingRaw)) {
      return showToast('Actual received and reading must be valid numbers.', 'error');
    }
    if (actualRaw < 0 || readingRaw < 0 || actualRaw > MAX_MONEY || readingRaw > MAX_MONEY) {
      return showToast('Actual received and reading must be within the allowed non-negative range.', 'error');
    }

    const actual = roundMoney(actualRaw);
    const readingValue = roundMoney(readingRaw);
    const differenceValue = roundMoney(actual - Number(selectedCheckerReport.reported_total || 0));
    const remarks = byId('checkerRemarks').value.trim();

    if (differenceValue !== 0 && !remarks) {
      return showToast('Verification remarks are required when there is a difference.', 'error');
    }

    setLoading(true, 'Saving verification…');
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
      showToast('Deposit verification saved successfully.', 'success');
      await loadData();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Unable to save verification.', 'error');
    } finally {
      setLoading(false);
    }
  };

  function safeCsvCell(value) {
    let text = String(value ?? '');
    // Prevent spreadsheet applications from interpreting imported text as formulas.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  exportCsv = function hardenedExportCsv() {
    if (!reports.length) return showToast('There are no reports to export.', 'error');

    const headers = [
      'Branch', 'Date', ...PAYMENT_TYPES.map((item) => item.label),
      'Reported Total', 'Actual Received', 'Reading', 'Difference',
      'Customers', 'Status', 'Store Remarks', 'Verification Remarks'
    ];
    const rows = reports.map((report) => {
      const verification = verificationFor(report);
      return [
        report.branches?.name || '',
        report.business_date,
        ...PAYMENT_TYPES.map(({ key }) => report[key] || 0),
        report.reported_total || 0,
        verification?.actual_received ?? '',
        verification?.reading ?? '',
        verification?.difference ?? '',
        report.customer_count || 0,
        statusLabel(report.status),
        report.store_remarks || '',
        verification?.remarks || ''
      ];
    });

    const csv = `\uFEFF${[headers, ...rows]
      .map((row) => row.map(safeCsvCell).join(','))
      .join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `KakingStoreCash-${byId('filterDate').value || manilaDateISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  function replaceDirectListenerButton(id, handler) {
    const current = document.getElementById(id);
    if (!current) return;
    const replacement = current.cloneNode(true);
    current.replaceWith(replacement);
    replacement.addEventListener('click', handler);
  }

  document.querySelectorAll('.payment, #actualReceived, #reading').forEach((input) => {
    input.setAttribute('inputmode', 'decimal');
    input.addEventListener('blur', () => normalizeMoneyInput(input));
  });
  byId('customers')?.setAttribute('inputmode', 'numeric');
  byId('actualReceived')?.addEventListener('input', updateCheckerDifference);

  // app.js binds these handlers by direct function reference. Replacing the buttons
  // removes the older listeners so only the hardened implementations execute.
  replaceDirectListenerButton('verifyBtn', saveVerification);
  replaceDirectListenerButton('exportBtn', exportCsv);

  installLocalBusinessDate();
})();
