'use strict';

(function installDirectJulySampleDataFallback() {
  if (window.__KSC_DIRECT_JULY_SAMPLE_DATA_V1__) return;
  window.__KSC_DIRECT_JULY_SAMPLE_DATA_V1__ = true;

  const originalFetch = window.fetch.bind(window);
  const START_DATE = '2026-07-01';
  const END_DATE = '2026-07-31';
  const CONFIRMATION = 'GENERATE JULY 2026 SAMPLE DATA';

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
    return String(input || '');
  }

  function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function currentDatabase() {
    try { return typeof db !== 'undefined' ? db : null; }
    catch (_) { return null; }
  }

  function currentProfile() {
    try { return typeof profile !== 'undefined' ? profile : null; }
    catch (_) { return null; }
  }

  function currentUserId() {
    try { return typeof session !== 'undefined' && session?.user?.id ? String(session.user.id) : ''; }
    catch (_) { return ''; }
  }

  function assertAdministrator() {
    if (currentProfile()?.role !== 'admin') {
      throw new Error('Only an active System Administrator can generate sample data.');
    }
    if (!currentUserId()) throw new Error('Your administrator session expired. Sign out and sign in again.');
    if (!currentDatabase()) throw new Error('The database connection is not ready.');
  }

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function isoDate(day) {
    return `2026-07-${String(day).padStart(2, '0')}`;
  }

  function submittedAt(day) {
    return new Date(Date.UTC(2026, 6, day, 13, 0, 0)).toISOString();
  }

  function paymentValues(branchNumber, day) {
    const date = new Date(Date.UTC(2026, 6, day, 12, 0, 0));
    const weekend = [0, 6].includes(date.getUTCDay());
    return {
      cash: roundMoney(1800 + branchNumber * 325 + day * 47.35 + (weekend ? 450 : 0)),
      gcash: roundMoney(650 + branchNumber * 75 + day * 23.15),
      maya: roundMoney(320 + branchNumber * 52 + day * 15.45),
      credit: roundMoney(520 + branchNumber * 68 + day * 20.25),
      debit: roundMoney(610 + branchNumber * 61 + day * 18.75),
      cheque: (day + branchNumber) % 7 === 0 ? roundMoney(700 + branchNumber * 100 + day * 11.5) : 0,
      salmon: day % 3 === 0 ? roundMoney(280 + branchNumber * 35 + day * 7.25) : 0,
      other: (day + branchNumber) % 4 === 0 ? roundMoney(150 + day * 9.5) : 0,
      customer_count: 55 + branchNumber * 8 + day * 3 + (weekend ? 24 : 0)
    };
  }

  function reportKey(branchId, businessDate) {
    return `${branchId}:${businessDate}`;
  }

  async function readPreview() {
    assertAdministrator();
    const database = currentDatabase();
    const [branchResult, reportResult] = await Promise.all([
      database.from('branches').select('id,code,name,active').eq('active', true).order('code'),
      database.from('daily_reports').select('id', { count: 'exact', head: true }).gte('business_date', START_DATE).lte('business_date', END_DATE)
    ]);
    if (branchResult.error) throw branchResult.error;
    if (reportResult.error) throw reportResult.error;
    const activeBranches = branchResult.data || [];
    const existingReports = Number(reportResult.count || 0);
    return {
      period: { from: START_DATE, to: END_DATE, days: 31 },
      active_branches: activeBranches.length,
      expected_reports: activeBranches.length * 31,
      existing_reports: existingReports,
      can_generate: activeBranches.length > 0 && existingReports === 0
    };
  }

  async function generateSampleData(payload) {
    assertAdministrator();
    if (String(payload?.confirmation || '').trim() !== CONFIRMATION) {
      throw new Error('The sample-data confirmation phrase is incorrect.');
    }
    if (payload?.acknowledged !== true) {
      throw new Error('Confirm that the generated records are temporary test data.');
    }

    const database = currentDatabase();
    const actorId = currentUserId();
    const preview = await readPreview();
    if (!preview.active_branches) throw new Error('No active branches are available for sample-data generation.');
    if (preview.existing_reports > 0) {
      throw new Error(`July 2026 already contains ${preview.existing_reports} report(s). Reset or preserve those records before generating sample data.`);
    }

    const branchResult = await database.from('branches').select('id,code,name').eq('active', true).order('code');
    if (branchResult.error) throw branchResult.error;
    const activeBranches = branchResult.data || [];
    const branchNumbers = new Map(activeBranches.map((branch, index) => [branch.id, index + 1]));
    const reportRows = [];

    activeBranches.forEach((branch, index) => {
      const branchNumber = index + 1;
      for (let day = 1; day <= 31; day += 1) {
        const businessDate = isoDate(day);
        const submitted = submittedAt(day);
        reportRows.push({
          branch_id: branch.id,
          business_date: businessDate,
          ...paymentValues(branchNumber, day),
          store_remarks: `[SAMPLE DATA JULY 2026] Performance test record for ${branch.code} on ${businessDate}.`,
          status: 'pending_verification',
          submitted_by: actorId,
          submitted_at: submitted,
          created_at: new Date(new Date(submitted).getTime() - 20 * 60000).toISOString(),
          updated_at: submitted
        });
      }
    });

    const insertedReports = await database
      .from('daily_reports')
      .insert(reportRows)
      .select('id,branch_id,business_date,reported_total');
    if (insertedReports.error) throw insertedReports.error;

    const insertedByKey = new Map((insertedReports.data || []).map((row) => [reportKey(row.branch_id, row.business_date), row]));
    const verificationRows = [];
    let pending = 0;
    let matched = 0;
    let withDifference = 0;

    activeBranches.forEach((branch) => {
      const branchNumber = branchNumbers.get(branch.id) || 1;
      for (let day = 1; day <= 31; day += 1) {
        if ((day + branchNumber) % 5 === 0) {
          pending += 1;
          continue;
        }

        const report = insertedByKey.get(reportKey(branch.id, isoDate(day)));
        if (!report) throw new Error(`The generated report for ${branch.code} on ${isoDate(day)} could not be located.`);
        const variance = (day + branchNumber) % 7 === 0
          ? ((day + branchNumber) % 2 === 0 ? 100 : -75)
          : 0;
        const actual = roundMoney(Number(report.reported_total || 0) + variance);
        const verifiedAt = new Date(new Date(submittedAt(day)).getTime() + 2 * 60 * 60000).toISOString();
        const remarks = variance < 0
          ? `[SAMPLE DATA] Simulated shortage of ${Math.abs(variance).toFixed(2)} for performance and alert testing.`
          : variance > 0
            ? `[SAMPLE DATA] Simulated overage of ${variance.toFixed(2)} for performance and alert testing.`
            : null;

        verificationRows.push({
          report_id: report.id,
          actual_received: actual,
          reading: actual,
          remarks,
          verified_by: actorId,
          verified_at: verifiedAt,
          created_at: verifiedAt,
          updated_at: verifiedAt
        });
        if (variance === 0) matched += 1;
        else withDifference += 1;
      }
    });

    if (verificationRows.length) {
      const verificationResult = await database.from('deposit_verifications').insert(verificationRows).select('id');
      if (verificationResult.error) {
        throw new Error(`The ${reportRows.length} sample reports were created, but deposit verification generation failed: ${verificationResult.error.message}. Use Data Reset and Recovery before retrying.`);
      }
    }

    return {
      success: true,
      period: { from: START_DATE, to: END_DATE },
      active_branches: activeBranches.length,
      reports: reportRows.length,
      verifications: verificationRows.length,
      matched,
      with_difference: withDifference,
      pending,
      generated_at: new Date().toISOString(),
      generated_by: currentProfile()?.full_name || 'System Administrator',
      generation_mode: 'direct_admin_session'
    };
  }

  window.fetch = async function directSampleDataFetch(input, init = {}) {
    const url = requestUrl(input);
    const method = String(init.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'POST' || !/\/functions\/v1\/admin-sample-data(?:\?|$)/.test(url)) {
      return originalFetch(input, init);
    }

    try {
      const rawBody = typeof init.body === 'string' ? init.body : '{}';
      const payload = JSON.parse(rawBody || '{}');
      if (payload.action === 'preview') return jsonResponse(await readPreview());
      if (payload.action === 'generate') return jsonResponse(await generateSampleData(payload));
      return jsonResponse({ error: 'Unsupported sample-data action.' }, 400);
    } catch (error) {
      console.error('Direct July sample-data generation failed:', error);
      return jsonResponse({ error: error?.message || 'Unable to generate July sample data.' }, 500);
    }
  };
})();