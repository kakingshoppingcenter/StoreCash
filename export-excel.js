'use strict';

(function installNativeXlsxExport() {
  if (window.__KSC_NATIVE_XLSX_EXPORT_V1__) return;
  window.__KSC_NATIVE_XLSX_EXPORT_V1__ = true;

  const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const MONEY_FORMAT = '₱#,##0.00;[Red]-₱#,##0.00';
  const INTEGER_FORMAT = '#,##0';
  const COLUMN_KEYS = [
    'branch', 'date', 'cash', 'gcash', 'maya', 'credit', 'debit', 'cheque', 'salmon', 'other',
    'reported', 'actual', 'reading', 'difference', 'customers', 'status', 'storeRemarks', 'verificationRemarks'
  ];

  let excelJsPromise = null;
  let exporting = false;

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function sourceReports() {
    try {
      if (Array.isArray(reports)) return reports;
    } catch (_) {
      // Continue to the window fallback.
    }
    return Array.isArray(window.reports) ? window.reports : [];
  }

  function reportVerification(report) {
    try {
      if (typeof verificationFor === 'function') return verificationFor(report);
    } catch (_) {
      // Fall through to the embedded relationship.
    }
    const value = report?.deposit_verifications;
    return Array.isArray(value) ? value[0] || null : value || null;
  }

  function reportStatus(status) {
    try {
      if (typeof statusLabel === 'function') return statusLabel(status);
    } catch (_) {
      // Use the stored value below.
    }
    return String(status || '');
  }

  function dateValue(value) {
    const text = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text || '—';
    const [year, month, day] = text.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function currentPeriod() {
    const mode = document.getElementById('reportMode')?.value || 'day';
    const anchor = document.getElementById('filterDate')?.value || new Date().toISOString().slice(0, 10);
    const from = document.getElementById('filterFrom')?.value || anchor;
    const to = document.getElementById('filterTo')?.value || anchor;

    if (mode === 'range') return { mode, from, to };
    if (mode === 'week') return { mode, from, to };
    return { mode: 'day', from: anchor, to: anchor };
  }

  function periodLabel(period) {
    if (period.from === period.to) return period.from;
    return `${period.from} to ${period.to}`;
  }

  function filename(period) {
    const suffix = period.from === period.to ? period.from : `${period.from}_to_${period.to}`;
    return `KakingStoreCash-${period.mode}-${suffix}.xlsx`;
  }

  function loadExcelJs() {
    if (window.ExcelJS?.Workbook) return Promise.resolve(window.ExcelJS);
    if (excelJsPromise) return excelJsPromise;

    excelJsPromise = new Promise((resolve, reject) => {
      let script = document.querySelector('script[data-ksc-exceljs]');

      const finish = () => {
        if (window.ExcelJS?.Workbook) resolve(window.ExcelJS);
        else reject(new Error('Excel workbook library did not initialize.'));
      };

      if (script) {
        script.addEventListener('load', finish, { once: true });
        script.addEventListener('error', () => reject(new Error('Unable to load the Excel workbook library.')), { once: true });
        window.setTimeout(finish, 0);
        return;
      }

      script = document.createElement('script');
      script.src = EXCELJS_URL;
      script.dataset.kscExceljs = 'true';
      script.async = true;
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', () => reject(new Error('Unable to load the Excel workbook library.')), { once: true });
      document.head.appendChild(script);
    }).catch((error) => {
      excelJsPromise = null;
      throw error;
    });

    return excelJsPromise;
  }

  function applyThinBorder(cell) {
    const side = { style: 'thin', color: { argb: 'FFE3EAF2' } };
    cell.border = { top: side, left: side, bottom: side, right: side };
  }

  function styleTitleRows(worksheet, period, reportCount) {
    worksheet.mergeCells('A1:R1');
    const title = worksheet.getCell('A1');
    title.value = 'KAKING STORE CASH — STORE CASH AND DEPOSIT REPORT';
    title.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFF1BF36' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells('A2:R2');
    const subtitle = worksheet.getCell('A2');
    subtitle.value = `Reporting Period: ${periodLabel(period)} | ${reportCount} report${reportCount === 1 ? '' : 's'} | Generated: ${new Date().toLocaleString('en-PH')}`;
    subtitle.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF405269' } };
    subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF4FB' } };
    subtitle.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 22;
  }

  function styleHeaderRow(row) {
    row.height = 34;
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1268E8' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      applyThinBorder(cell);
    });
  }

  function styleDataRow(row, alternate) {
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF172033' } };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: columnNumber >= 17
      };
      if (alternate) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFD' } };
      }
      applyThinBorder(cell);
    });

    for (let column = 3; column <= 14; column += 1) {
      const cell = row.getCell(column);
      if (typeof cell.value === 'number') cell.numFmt = MONEY_FORMAT;
    }
    row.getCell(15).numFmt = INTEGER_FORMAT;
    if (row.getCell(2).value instanceof Date) row.getCell(2).numFmt = 'mmm d, yyyy';
  }

  function styleStatusCell(cell, status) {
    const normalized = String(status || '').toLowerCase();
    let fill = 'FFEEF2F6';
    let color = 'FF5D6B7E';

    if (normalized.includes('matched')) {
      fill = 'FFDCF7E5';
      color = 'FF14733A';
    } else if (normalized.includes('difference')) {
      fill = 'FFFFE2E2';
      color = 'FFB42318';
    } else if (normalized.includes('pending')) {
      fill = 'FFFFF4DA';
      color = 'FF926400';
    }

    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: color } };
  }

  function addTotalsRow(worksheet, totals, rowNumber, reportCount) {
    worksheet.mergeCells(`A${rowNumber}:B${rowNumber}`);
    worksheet.getCell(`A${rowNumber}`).value = 'GRAND TOTAL';

    const values = [
      totals.cash, totals.gcash, totals.maya, totals.credit, totals.debit, totals.cheque,
      totals.salmon, totals.other, totals.reported, totals.actual, totals.reading,
      totals.difference, totals.customers
    ];

    values.forEach((value, index) => {
      worksheet.getCell(rowNumber, index + 3).value = value;
    });

    worksheet.mergeCells(`P${rowNumber}:R${rowNumber}`);
    worksheet.getCell(`P${rowNumber}`).value = `${reportCount} branch report${reportCount === 1 ? '' : 's'}`;

    const row = worksheet.getRow(rowNumber);
    row.height = 25;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      applyThinBorder(cell);
      if (columnNumber >= 3 && columnNumber <= 14) cell.numFmt = MONEY_FORMAT;
      if (columnNumber === 15) cell.numFmt = INTEGER_FORMAT;
    });
  }

  async function buildWorkbook(ExcelJS, sortedReports, period) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kaking Store Cash';
    workbook.lastModifiedBy = 'Kaking Store Cash';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = 'Store cash and deposit reconciliation report';
    workbook.title = `Kaking Store Cash ${periodLabel(period)}`;
    workbook.company = 'Kaking Store Cash';

    const worksheet = workbook.addWorksheet('Store Reports', {
      properties: { defaultRowHeight: 20 },
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
      }
    });

    worksheet.columns = [
      { header: 'Branch', key: 'branch', width: 24 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'CASH', key: 'cash', width: 13 },
      { header: 'G-CASH', key: 'gcash', width: 13 },
      { header: 'MAYA', key: 'maya', width: 13 },
      { header: 'CREDIT', key: 'credit', width: 13 },
      { header: 'DEBIT', key: 'debit', width: 13 },
      { header: 'CHEQUE', key: 'cheque', width: 13 },
      { header: 'SALMON', key: 'salmon', width: 13 },
      { header: 'OTHER', key: 'other', width: 13 },
      { header: 'Reported Total', key: 'reported', width: 16 },
      { header: 'Actual Received', key: 'actual', width: 16 },
      { header: 'Reading', key: 'reading', width: 14 },
      { header: 'Difference', key: 'difference', width: 15 },
      { header: 'Customers', key: 'customers', width: 12 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Store Remarks', key: 'storeRemarks', width: 30 },
      { header: 'Verification Remarks', key: 'verificationRemarks', width: 30 }
    ];

    worksheet.spliceRows(1, 0, [], []);
    const headerRow = worksheet.getRow(3);
    COLUMN_KEYS.forEach((key, index) => {
      headerRow.getCell(index + 1).value = worksheet.getColumn(key).header;
    });
    styleTitleRows(worksheet, period, sortedReports.length);
    styleHeaderRow(headerRow);

    const totals = {
      cash: 0, gcash: 0, maya: 0, credit: 0, debit: 0, cheque: 0, salmon: 0, other: 0,
      reported: 0, actual: 0, reading: 0, difference: 0, customers: 0
    };

    sortedReports.forEach((report, index) => {
      const verification = reportVerification(report);
      const values = {
        branch: report.branches?.name || report.branches?.code || 'Unknown',
        date: dateValue(report.business_date),
        cash: finiteNumber(report.cash),
        gcash: finiteNumber(report.gcash),
        maya: finiteNumber(report.maya),
        credit: finiteNumber(report.credit),
        debit: finiteNumber(report.debit),
        cheque: finiteNumber(report.cheque),
        salmon: finiteNumber(report.salmon),
        other: finiteNumber(report.other),
        reported: finiteNumber(report.reported_total),
        actual: verification ? finiteNumber(verification.actual_received) : 'Pending',
        reading: verification ? finiteNumber(verification.reading) : '',
        difference: verification ? finiteNumber(verification.difference) : '',
        customers: finiteNumber(report.customer_count),
        status: reportStatus(report.status),
        storeRemarks: report.store_remarks || '',
        verificationRemarks: verification?.remarks || ''
      };

      ['cash', 'gcash', 'maya', 'credit', 'debit', 'cheque', 'salmon', 'other', 'reported', 'customers']
        .forEach((key) => { totals[key] += finiteNumber(values[key]); });
      if (verification) {
        totals.actual += finiteNumber(values.actual);
        totals.reading += finiteNumber(values.reading);
        totals.difference += finiteNumber(values.difference);
      }

      const row = worksheet.addRow(values);
      styleDataRow(row, index % 2 === 1);
      styleStatusCell(row.getCell(16), values.status);
    });

    const totalRowNumber = worksheet.lastRow.number + 1;
    addTotalsRow(worksheet, totals, totalRowNumber, sortedReports.length);

    worksheet.views = [{ state: 'frozen', ySplit: 3, activeCell: 'A4' }];
    worksheet.autoFilter = { from: 'A3', to: `R${Math.max(3, totalRowNumber - 1)}` };
    worksheet.pageSetup.printTitlesRow = '1:3';
    worksheet.headerFooter.oddFooter = '&LKaking Store Cash&CPage &P of &N&RGenerated &D &T';

    return workbook;
  }

  function downloadBuffer(buffer, name) {
    const blob = new Blob([buffer], { type: XLSX_MIME });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function exportNativeXlsx(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (exporting) return;

    const button = document.getElementById('exportBtn');
    const originalText = button?.textContent || 'Export Excel';
    const sortedReports = [...sourceReports()].sort((left, right) => {
      const dateCompare = String(right.business_date || '').localeCompare(String(left.business_date || ''));
      if (dateCompare !== 0) return dateCompare;
      const leftName = left.branches?.name || left.branches?.code || '';
      const rightName = right.branches?.name || right.branches?.code || '';
      return leftName.localeCompare(rightName, 'en', { sensitivity: 'base' });
    });

    if (!sortedReports.length) {
      if (typeof showToast === 'function') showToast('There are no reports to export.', 'error');
      return;
    }

    exporting = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparing Excel…';
    }

    try {
      const ExcelJS = await loadExcelJs();
      const period = currentPeriod();
      const workbook = await buildWorkbook(ExcelJS, sortedReports, period);
      const buffer = await workbook.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
      downloadBuffer(buffer, filename(period));
      if (typeof showToast === 'function') showToast('Excel workbook exported successfully.', 'success');
    } catch (error) {
      console.error('Excel export failed:', error);
      if (typeof showToast === 'function') showToast(error.message || 'Unable to create the Excel workbook.', 'error');
    } finally {
      exporting = false;
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  function initializeExport() {
    const button = document.getElementById('exportBtn');
    if (!button || button.dataset.nativeXlsxReady === 'true') return;

    button.dataset.nativeXlsxReady = 'true';
    button.textContent = 'Export Excel';
    button.title = 'Download a genuine Microsoft Excel .xlsx workbook';
    button.addEventListener('click', exportNativeXlsx, { capture: true });

    window.setTimeout(() => {
      loadExcelJs().catch(() => {
        // The export button will report a clear error if the library remains unavailable.
      });
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExport, { once: true });
  } else {
    initializeExport();
  }
})();