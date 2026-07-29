'use strict';

(function installDuplicateSafeReportSaving() {
  const EDITABLE_STATUSES = new Set(['draft', 'reopened']);

  async function findExistingReport(branchId, businessDate) {
    const cached = reports.find((report) => (
      report.branch_id === branchId && report.business_date === businessDate
    ));
    if (cached) return cached;

    const { data, error } = await db
      .from('daily_reports')
      .select('id,branch_id,business_date,status,submitted_by,submitted_at')
      .eq('branch_id', branchId)
      .eq('business_date', businessDate)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function updateExistingReport(existing, payload) {
    if (!EDITABLE_STATUSES.has(existing.status)) {
      throw new Error('This report is finalized and locked. Reopen the report before changing its values.');
    }

    payload.submitted_by = existing.submitted_by || session.user.id;
    if (payload.status === 'draft') {
      payload.submitted_at = existing.submitted_at || null;
    }

    const { error } = await db
      .from('daily_reports')
      .update(payload)
      .eq('id', existing.id);

    if (error) throw error;
    return existing.id;
  }

  async function insertNewReport(payload, branchId, businessDate) {
    const { data, error } = await db
      .from('daily_reports')
      .insert(payload)
      .select('id')
      .single();

    if (!error) return data?.id || null;

    // A second browser tab or stale UI may discover the same branch/date between
    // the pre-save lookup and insert. Resolve that race safely as an update.
    if (error.code === '23505' || /daily_reports_branch_id_business_date_key|duplicate key/i.test(error.message || '')) {
      const existing = await findExistingReport(branchId, businessDate);
      if (!existing) throw error;
      return updateExistingReport(existing, payload);
    }

    throw error;
  }

  async function saveEntryWithoutDuplicates(status) {
    const validationMessage = validateEntry();
    if (validationMessage) {
      showToast(validationMessage, 'error');
      return;
    }

    const branchId = byId('branch').value;
    const businessDate = byId('businessDate').value;
    const actionText = status === 'draft' ? 'Saving draft…' : 'Submitting report…';

    setLoading(true, actionText);
    try {
      const existing = await findExistingReport(branchId, businessDate);
      const payload = entryPayload(status);
      let reportId;

      if (existing) {
        reportId = await updateExistingReport(existing, payload);
      } else {
        payload.submitted_by = session.user.id;
        reportId = await insertNewReport(payload, branchId, businessDate);
      }

      showToast(
        status === 'draft'
          ? 'Draft saved securely.'
          : 'Daily report submitted successfully.',
        'success'
      );

      await loadData();
      selectedEntryReport = reports.find((report) => report.id === reportId)
        || reports.find((report) => report.branch_id === branchId && report.business_date === businessDate)
        || null;
      loadEntryReport();
    } catch (error) {
      console.error('Duplicate-safe report save failed:', error);
      const raw = String(error?.message || 'Unable to save the report.');
      const message = /finalized and locked|submitted reports are locked/i.test(raw)
        ? 'This report is finalized and locked. Use Reopen Report before correcting its values.'
        : raw;
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  saveEntry = saveEntryWithoutDuplicates;
})();
