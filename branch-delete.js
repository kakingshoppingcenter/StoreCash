'use strict';

(function installProtectedBranchDeletion() {
  const MIN_CONFIRMATION_LENGTH = 2;
  let branchPendingDeletion = null;
  let deleting = false;

  function installStyles() {
    if (document.getElementById('branchDeleteStyles')) return;

    const style = document.createElement('style');
    style.id = 'branchDeleteStyles';
    style.textContent = `
      .admin-table .branch-actions{width:84px;text-align:right;white-space:nowrap}
      .branch-delete-btn{border:1px solid #efc4c0;border-radius:8px;padding:6px 10px;background:#fff6f5;color:#b42318;font:inherit;font-size:10px;font-weight:750;cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .15s ease}
      .branch-delete-btn:hover:not(:disabled){background:#ffe9e6;border-color:#e69b94;transform:translateY(-1px)}
      .branch-delete-btn:disabled{cursor:not-allowed;opacity:.55}
      .branch-delete-backdrop{position:fixed;inset:0;z-index:10040;display:grid;place-items:center;padding:20px;background:rgba(7,19,35,.66);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
      .branch-delete-backdrop.hidden{display:none}
      .branch-delete-modal{width:min(100%,510px);overflow:hidden;border:1px solid #dbe4ef;border-radius:18px;background:#fff;box-shadow:0 28px 75px rgba(10,31,58,.3)}
      .branch-delete-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 22px 14px}
      .branch-delete-header h3{margin:0 0 6px;color:#8f1d14;font-size:21px;line-height:1.2}
      .branch-delete-header p{margin:0;color:#66758a;font-size:12px;line-height:1.55}
      .branch-delete-close{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border:1px solid #dbe4ef;border-radius:9px;background:#fff;color:#43536a;font-size:20px;cursor:pointer}
      .branch-delete-form{display:grid;gap:14px;padding:6px 22px 22px}
      .branch-delete-summary{display:grid;gap:7px;padding:12px 13px;border:1px solid #e1e8f1;border-radius:10px;background:#f8fafc;font-size:11px}
      .branch-delete-summary div{display:flex;justify-content:space-between;gap:14px}.branch-delete-summary span{color:#66758a}.branch-delete-summary strong{text-align:right;color:#203047}
      .branch-delete-warning{margin:0;padding:12px;border:1px solid #f0c6c2;border-radius:9px;background:#fff4f2;color:#8f1d14;font-size:11px;line-height:1.55}
      .branch-delete-help{margin:-6px 0 0;color:#66758a;font-size:10px;line-height:1.45}
      .branch-delete-message{min-height:17px;margin:0;color:#b42318;font-size:11px;font-weight:650;text-align:center}
      .branch-delete-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:10px}
      .btn.branch-delete-confirm{background:#b42318;border-color:#b42318;color:#fff}.btn.branch-delete-confirm:hover:not(:disabled){background:#8f1d14;border-color:#8f1d14}
      body.branch-delete-open{overflow:hidden}
      @media(max-width:620px){.branch-delete-backdrop{align-items:end;padding:0}.branch-delete-modal{width:100%;border-radius:18px 18px 0 0}.branch-delete-header{padding:20px 18px 12px}.branch-delete-form{padding:6px 18px 20px}.branch-delete-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let backdrop = document.getElementById('branchDeleteBackdrop');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.id = 'branchDeleteBackdrop';
    backdrop.className = 'branch-delete-backdrop hidden';
    backdrop.innerHTML = `
      <section class="branch-delete-modal" role="dialog" aria-modal="true" aria-labelledby="branchDeleteTitle">
        <header class="branch-delete-header">
          <div>
            <h3 id="branchDeleteTitle">Delete Branch</h3>
            <p>Remove an unused branch from the system configuration.</p>
          </div>
          <button id="branchDeleteCloseBtn" class="branch-delete-close" type="button" aria-label="Close delete branch dialog">×</button>
        </header>
        <form id="branchDeleteForm" class="branch-delete-form" novalidate>
          <div id="branchDeleteSummary" class="branch-delete-summary"></div>
          <p class="branch-delete-warning"><strong>Permanent action.</strong> A branch with assigned users or financial reports cannot be deleted. Deactivate it instead when historical records must be retained.</p>
          <label>
            Type the branch code to confirm
            <input id="branchDeleteConfirmation" type="text" maxlength="20" autocomplete="off" spellcheck="false" required />
          </label>
          <p id="branchDeleteHelp" class="branch-delete-help"></p>
          <p id="branchDeleteMessage" class="branch-delete-message" aria-live="polite"></p>
          <div class="branch-delete-actions">
            <button id="branchDeleteCancelBtn" class="btn ghost" type="button">Cancel</button>
            <button id="branchDeleteConfirmBtn" class="btn branch-delete-confirm" type="submit">Delete Branch</button>
          </div>
        </form>
      </section>`;

    document.body.appendChild(backdrop);
    document.getElementById('branchDeleteCloseBtn').addEventListener('click', closeModal);
    document.getElementById('branchDeleteCancelBtn').addEventListener('click', closeModal);
    document.getElementById('branchDeleteForm').addEventListener('submit', confirmDeletion);
    document.getElementById('branchDeleteConfirmation').addEventListener('input', () => setMessage(''));
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop && !deleting) closeModal();
    });
    return backdrop;
  }

  function setMessage(message) {
    const target = document.getElementById('branchDeleteMessage');
    if (target) target.textContent = message;
  }

  function setDeleting(value) {
    deleting = value;
    const confirm = document.getElementById('branchDeleteConfirmBtn');
    const cancel = document.getElementById('branchDeleteCancelBtn');
    const close = document.getElementById('branchDeleteCloseBtn');
    if (confirm) {
      confirm.disabled = value;
      confirm.textContent = value ? 'Deleting Branch…' : 'Delete Branch';
    }
    if (cancel) cancel.disabled = value;
    if (close) close.disabled = value;
  }

  function openModal(branchId) {
    if (typeof hasPermission !== 'function' || !hasPermission('manage_branches')) {
      showToast('You are not authorized to delete branches.', 'error');
      return;
    }

    branchPendingDeletion = adminBranches.find((branch) => branch.id === branchId) || null;
    if (!branchPendingDeletion) {
      showToast('The selected branch could not be found.', 'error');
      return;
    }

    const backdrop = ensureModal();
    const summary = document.getElementById('branchDeleteSummary');
    summary.innerHTML = `
      <div><span>Branch Code</span><strong>${escapeHtml(branchPendingDeletion.code)}</strong></div>
      <div><span>Branch Name</span><strong>${escapeHtml(branchPendingDeletion.name)}</strong></div>
      <div><span>Current Status</span><strong>${branchPendingDeletion.active ? 'Active' : 'Inactive'}</strong></div>`;

    document.getElementById('branchDeleteForm').reset();
    document.getElementById('branchDeleteHelp').textContent = `Enter ${branchPendingDeletion.code} exactly to continue.`;
    setMessage('');
    backdrop.classList.remove('hidden');
    document.body.classList.add('branch-delete-open');
    window.setTimeout(() => document.getElementById('branchDeleteConfirmation')?.focus(), 30);
  }

  function closeModal() {
    if (deleting) return;
    const backdrop = document.getElementById('branchDeleteBackdrop');
    if (!backdrop || backdrop.classList.contains('hidden')) return;
    backdrop.classList.add('hidden');
    document.body.classList.remove('branch-delete-open');
    document.getElementById('branchDeleteForm')?.reset();
    branchPendingDeletion = null;
    setMessage('');
  }

  function friendlyDeleteError(error) {
    const raw = String(error?.message || 'Unable to delete the branch.');
    if (/assigned user/i.test(raw)) return `${raw} Reassign or deactivate those accounts first.`;
    if (/financial report|daily report/i.test(raw)) return `${raw} Set the branch to inactive instead to preserve history.`;
    if (/foreign key|23503|still referenced/i.test(raw)) return 'This branch is already used by a user or financial report and cannot be deleted. Mark it inactive instead.';
    if (/permission denied|not authorized|42501/i.test(raw)) return 'Branch deletion is not installed or your account is not authorized. Run supabase/branch_delete_extension.sql, then retry.';
    if (/function|schema cache/i.test(raw)) return 'The branch deletion database extension is not installed. Run supabase/branch_delete_extension.sql, then refresh the system.';
    return raw;
  }

  async function confirmDeletion(event) {
    event.preventDefault();
    if (!branchPendingDeletion || deleting) return;

    const confirmation = document.getElementById('branchDeleteConfirmation').value.trim().toUpperCase();
    const requiredCode = String(branchPendingDeletion.code || '').trim().toUpperCase();
    if (confirmation.length < MIN_CONFIRMATION_LENGTH || confirmation !== requiredCode) {
      setMessage(`Type ${requiredCode} exactly to confirm deletion.`);
      return;
    }

    setDeleting(true);
    setLoading(true, 'Deleting unused branch…');
    try {
      const { data, error } = await db
        .from('branches')
        .delete()
        .eq('id', branchPendingDeletion.id)
        .select('id,code,name')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('The branch was not deleted. Confirm that your account has branch-management permission.');

      const deletedId = branchPendingDeletion.id;
      closeModalAfterSuccess();
      if (selectedAdminBranchId === deletedId) resetBranchForm();
      showToast(`Branch ${data.code} deleted successfully.`, 'success');
      await loadData();
      await loadBranchesAdministration();
    } catch (error) {
      console.error('Branch deletion failed:', error);
      setMessage(friendlyDeleteError(error));
    } finally {
      setLoading(false);
      setDeleting(false);
    }
  }

  function closeModalAfterSuccess() {
    const backdrop = document.getElementById('branchDeleteBackdrop');
    backdrop?.classList.add('hidden');
    document.body.classList.remove('branch-delete-open');
    document.getElementById('branchDeleteForm')?.reset();
    branchPendingDeletion = null;
    setMessage('');
  }

  function enhanceBranchTable() {
    const table = document.querySelector('#adminBranchRows')?.closest('table');
    const headerRow = table?.querySelector('thead tr');
    if (!table || !headerRow) return;

    if (!headerRow.querySelector('[data-branch-actions-header]')) {
      const header = document.createElement('th');
      header.dataset.branchActionsHeader = 'true';
      header.className = 'branch-actions';
      header.textContent = 'Action';
      headerRow.appendChild(header);
    }

    table.querySelectorAll('#adminBranchRows tr[data-admin-branch-id]').forEach((row) => {
      if (row.querySelector('.branch-delete-btn')) return;
      const branch = adminBranches.find((item) => item.id === row.dataset.adminBranchId);
      if (!branch) return;

      const cell = document.createElement('td');
      cell.className = 'branch-actions';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'branch-delete-btn';
      button.textContent = 'Delete';
      button.setAttribute('aria-label', `Delete branch ${branch.name}`);
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openModal(branch.id);
      });
      cell.appendChild(button);
      row.appendChild(cell);
    });

    const emptyRow = table.querySelector('#adminBranchRows tr:not([data-admin-branch-id]) td[colspan]');
    if (emptyRow) emptyRow.colSpan = 5;
  }

  function wrapBranchRendering() {
    if (typeof renderBranchTable !== 'function') return;
    const originalRenderBranchTable = renderBranchTable;
    renderBranchTable = function protectedBranchTableRenderer() {
      const result = originalRenderBranchTable();
      enhanceBranchTable();
      return result;
    };
    enhanceBranchTable();
  }

  installStyles();
  ensureModal();
  wrapBranchRendering();
})();
