'use strict';

(function installFormattedExcelExport() {
  const COLUMN_COUNT = 18;
  const COLUMN_WIDTHS = [120, 85, 82, 82, 82, 82, 82, 82, 82, 82, 105, 110, 95, 100, 80, 120, 190, 190];

  function xmlEscape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function textCell(value, style = 'CenteredText') {
    return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
  }

  function numberCell(value, style = 'Money') {
    return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${finiteNumber(value)}</Data></Cell>`;
  }

  function dateCell(value) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? `${value}T00:00:00.000` : '';
    return date
      ? `<Cell ss:StyleID="Date"><Data ss:Type="DateTime">${date}</Data></Cell>`
      : textCell('—');
  }

  function downloadBlob(content, filename) {
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function buildWorkbook() {
    const businessDate = document.getElementById('filterDate')?.value || new Date().toISOString().slice(0, 10);
    const sourceReports = Array.isArray(window.reports) ? window.reports : (typeof reports !== 'undefined' ? reports : []);
    const sortedReports = [...sourceReports].sort((left, right) => {
      const leftName = left.branches?.name || left.branches?.code || '';
      const rightName = right.branches?.name || right.branches?.code || '';
      return leftName.localeCompare(rightName, 'en', { sensitivity: 'base' });
    });

    if (!sortedReports.length) {
      if (typeof showToast === 'function') showToast('There are no reports to export.', 'error');
      return null;
    }

    const headers = [
      'Branch', 'Date', 'CASH', 'G-CASH', 'MAYA', 'CREDIT', 'DEBIT', 'CHEQUE', 'SALMON', 'OTHER',
      'Reported Total', 'Actual Received', 'Reading', 'Difference', 'Customers', 'Status',
      'Store Remarks', 'Verification Remarks'
    ];

    const totals = {
      cash: 0, gcash: 0, maya: 0, credit: 0, debit: 0, cheque: 0, salmon: 0, other: 0,
      reported: 0, actual: 0, reading: 0, difference: 0, customers: 0
    };

    const dataRows = sortedReports.map((report, index) => {
      const verification = typeof verificationFor === 'function' ? verificationFor(report) : null;
      const values = {
        cash: finiteNumber(report.cash),
        gcash: finiteNumber(report.gcash),
        maya: finiteNumber(report.maya),
        credit: finiteNumber(report.credit),
        debit: finiteNumber(report.debit),
        cheque: finiteNumber(report.cheque),
        salmon: finiteNumber(report.salmon),
        other: finiteNumber(report.other),
        reported: finiteNumber(report.reported_total),
        actual: verification ? finiteNumber(verification.actual_received) : 0,
        reading: verification ? finiteNumber(verification.reading) : 0,
        difference: verification ? finiteNumber(verification.difference) : 0,
        customers: finiteNumber(report.customer_count)
      };

      Object.keys(totals).forEach((key) => { totals[key] += values[key]; });
      const rowStyle = index % 2 === 0 ? 'CenteredText' : 'CenteredAlternate';
      const moneyStyle = index % 2 === 0 ? 'Money' : 'MoneyAlternate';
      const integerStyle = index % 2 === 0 ? 'Integer' : 'IntegerAlternate';
      const notesStyle = index % 2 === 0 ? 'CenteredWrap' : 'CenteredWrapAlternate';
      const status = typeof statusLabel === 'function' ? statusLabel(report.status) : String(report.status || '');

      return `<Row ss:AutoFitHeight="1">
        ${textCell(report.branches?.name || report.branches?.code || 'Unknown', rowStyle)}
        ${dateCell(report.business_date)}
        ${numberCell(values.cash, moneyStyle)}
        ${numberCell(values.gcash, moneyStyle)}
        ${numberCell(values.maya, moneyStyle)}
        ${numberCell(values.credit, moneyStyle)}
        ${numberCell(values.debit, moneyStyle)}
        ${numberCell(values.cheque, moneyStyle)}
        ${numberCell(values.salmon, moneyStyle)}
        ${numberCell(values.other, moneyStyle)}
        ${numberCell(values.reported, moneyStyle)}
        ${verification ? numberCell(values.actual, moneyStyle) : textCell('Pending', rowStyle)}
        ${verification ? numberCell(values.reading, moneyStyle) : textCell('—', rowStyle)}
        ${verification ? numberCell(values.difference, moneyStyle) : textCell('—', rowStyle)}
        ${numberCell(values.customers, integerStyle)}
        ${textCell(status, rowStyle)}
        ${textCell(report.store_remarks || '', notesStyle)}
        ${textCell(verification?.remarks || '', notesStyle)}
      </Row>`;
    }).join('');

    const totalRow = `<Row ss:Height="24">
      <Cell ss:StyleID="TotalLabel" ss:MergeAcross="1"><Data ss:Type="String">GRAND TOTAL</Data></Cell>
      ${numberCell(totals.cash, 'TotalMoney')}
      ${numberCell(totals.gcash, 'TotalMoney')}
      ${numberCell(totals.maya, 'TotalMoney')}
      ${numberCell(totals.credit, 'TotalMoney')}
      ${numberCell(totals.debit, 'TotalMoney')}
      ${numberCell(totals.cheque, 'TotalMoney')}
      ${numberCell(totals.salmon, 'TotalMoney')}
      ${numberCell(totals.other, 'TotalMoney')}
      ${numberCell(totals.reported, 'TotalMoney')}
      ${numberCell(totals.actual, 'TotalMoney')}
      ${numberCell(totals.reading, 'TotalMoney')}
      ${numberCell(totals.difference, 'TotalMoney')}
      ${numberCell(totals.customers, 'TotalInteger')}
      <Cell ss:StyleID="TotalText" ss:MergeAcross="2"><Data ss:Type="String">${sortedReports.length} branch report${sortedReports.length === 1 ? '' : 's'}</Data></Cell>
    </Row>`;

    const columns = COLUMN_WIDTHS.map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join('');
    const headerRow = `<Row ss:Height="34">${headers.map((header) => textCell(header, 'Header')).join('')}</Row>`;
    const totalRows = sortedReports.length + 4;

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Kaking Store Cash</Author>
  <Title>Daily Store Cash and Deposit Report</Title>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel"><WindowHeight>12345</WindowHeight><WindowWidth>24000</WindowWidth><ProtectStructure>False</ProtectStructure><ProtectWindows>False</ProtectWindows></ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders/><Font ss:FontName="Arial" ss:Size="10"/><Interior/><NumberFormat/><Protection/></Style>
  <Style ss:ID="Title"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1" ss:Color="#F1BF36"/><Interior ss:Color="#0B1F3A" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Subtitle"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#405269"/><Interior ss:Color="#EEF4FB" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2EE"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2EE"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2EE"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2EE"/></Borders><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1268E8" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CenteredText"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7EDF4"/></Borders></Style>
  <Style ss:ID="CenteredAlternate"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7EDF4"/></Borders><Interior ss:Color="#F7FAFD" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CenteredWrap"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7EDF4"/></Borders></Style>
  <Style ss:ID="CenteredWrapAlternate"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7EDF4"/></Borders><Interior ss:Color="#F7FAFD" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Money"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7EDF4"/></Borders><NumberFormat ss:Format="₱#,##0.00;[Red]-₱#,##0.00"/></Style>
  <Style ss:ID="MoneyAlternate"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7EDF4"/></Borders><Interior ss:Color="#F7FAFD" ss:Pattern="Solid"/><NumberFormat ss:Format="₱#,##0.00;[Red]-₱#,##0.00"/></Style>
  <Style ss:ID="Integer"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7EDF4"/></Borders><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="IntegerAlternate"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7EDF4"/></Borders><Interior ss:Color="#F7FAFD" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="Date"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E7EDF4"/></Borders><NumberFormat ss:Format="mmm d, yyyy"/></Style>
  <Style ss:ID="TotalLabel"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B1F3A" ss:Pattern="Solid"/></Style>
  <Style ss:ID="TotalMoney"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B1F3A" ss:Pattern="Solid"/><NumberFormat ss:Format="₱#,##0.00;[Red]-₱#,##0.00"/></Style>
  <Style ss:ID="TotalInteger"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B1F3A" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0"/></Style>
  <Style ss:ID="TotalText"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B1F3A" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="Daily Reports">
  <Table ss:ExpandedColumnCount="${COLUMN_COUNT}" ss:ExpandedRowCount="${totalRows}" x:FullColumns="1" x:FullRows="1">
   ${columns}
   <Row ss:Height="30"><Cell ss:StyleID="Title" ss:MergeAcross="17"><Data ss:Type="String">KAKING STORE CASH — DAILY REPORT</Data></Cell></Row>
   <Row ss:Height="22"><Cell ss:StyleID="Subtitle" ss:MergeAcross="17"><Data ss:Type="String">Business Date: ${xmlEscape(businessDate)} | Generated: ${xmlEscape(new Date().toLocaleString('en-PH'))}</Data></Cell></Row>
   ${headerRow}
   ${dataRows}
   ${totalRow}
  </Table>
  <AutoFilter x:Range="R3C1:R${sortedReports.length + 3}C18" xmlns="urn:schemas-microsoft-com:office:excel"/>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Selected/><FreezePanes/><FrozenNoSplit/><SplitHorizontal>3</SplitHorizontal><TopRowBottomPane>3</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>
 </Worksheet>
</Workbook>`;
  }

  function exportFormattedExcel(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const workbook = buildWorkbook();
    if (!workbook) return;
    const businessDate = document.getElementById('filterDate')?.value || new Date().toISOString().slice(0, 10);
    downloadBlob(`\uFEFF${workbook}`, `KakingStoreCash-${businessDate}.xls`);
    if (typeof showToast === 'function') showToast('Formatted Excel report exported successfully.', 'success');
  }

  function initializeExport() {
    const button = document.getElementById('exportBtn');
    if (!button || button.dataset.formattedExcelReady === 'true') return;
    button.dataset.formattedExcelReady = 'true';
    button.textContent = 'Export Excel';
    button.title = 'Download a professionally formatted Excel report';
    button.addEventListener('click', exportFormattedExcel, { capture: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExport, { once: true });
  } else {
    initializeExport();
  }
})();
