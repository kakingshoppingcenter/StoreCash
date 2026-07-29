'use strict';

(function installProtectedBranchDeletion() {
  const MIN_CONFIRMATION_LENGTH = 2;
  let branchPendingDeletion = null;
  let deleting = false;
  let lastFocusedElement = null;

  function installStyles() {
    if (document.getElementById('branchDeleteStyles')) return;

    const style = document.createElement('style');
    style.id = 'branchDeleteStyles';
    style.textContent = `
      .admin-table .branch-actions{width:92px;text-align:right;white-space:nowrap}
      .branch-delete-btn{display:inline-flex;align-items:center;justify-content:center;min-width:62px;border:1px solid #efc4c0;border-radius:9px;padding:7px 11px;background:#fff7f6;color:#b42318;font:inherit;font-size:10px;font-weight:800;letter-spacing:.01em;cursor:pointer;transition:transform .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease}
      .branch-delete-btn:hover:not(:disabled){transform:translateY(-1px);background:#ffebe8;border-color:#e6978f;box-shadow:0 7px 16px rgba(180,35,24,.12)}
      .branch-delete-btn:focus-visible{outline:3px solid rgba(180,35,24,.18);outline-offset:2px}
      .branch-delete-btn:disabled{cursor:not-allowed;opacity:.55}

      .branch-delete-backdrop{position:fixed;inset:0;z-index:30000;display:grid;place-items:center;padding:24px;background:rgba(7,18,34,.62);-webkit-backdrop-filter:blur(10px) saturate(105%);backdrop-filter:blur(10px) saturate(105%);opacity:1;visibility:visible;transition:opacity .18s ease,visibility .18s ease}
      .branch-delete-backdrop.hidden{opacity:0;visibility:hidden;pointer-events:none}
      .branch-delete-modal{position:relative;width:min(530px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;border:1px solid rgba(210,220,234,.95);border-radius:24px;background:#fff;box-shadow:0 34px 90px rgba(5,24,47,.34),0 7px 24px rgba(5,24,47,.12);transform:translateY(0) scale(1);transition:transform .2s ease;isolation:isolate}
      .branch-delete-backdrop.hidden .branch-delete-modal{transform:translateY(12px) scale(.975)}
      .branch-delete-modal:before{content:"";position:absolute;inset:0 0 auto;height:5px;background:linear-gradient(90deg,#9d2017,#d64535 55%,#ef8d7f);z-index:2}
      .branch-delete-modal:after{content:"";position:absolute;width:210px;height:210px;right:-125px;top:-135px;border-radius:50%;background:radial-gradient(circle,rgba(214,69,53,.12),rgba(214,69,53,0) 70%);pointer-events:none}

      .branch-delete-header{position:relative;display:flex;align-items:flex-start;gap:15px;padding:27px 62px 18px 24px}
      .branch-delete-icon{display:grid;place-items:center;width:48px;height:48px;flex:0 0 48px;border:1px solid #f0c6c2;border-radius:15px;background:linear-gradient(145deg,#fff7f6,#ffe9e6);color:#b42318;box-shadow:0 8px 18px rgba(180,35,24,.1)}
      .branch-delete-icon svg{width:22px;height:22px;stroke:currentColor}
      .branch-delete-heading{min-width:0}
      .branch-delete-eyebrow{display:block;margin:1px 0 5px;color:#9d2017;font-size:9px;font-weight:850;letter-spacing:.13em;text-transform:uppercase}
      .branch-delete-header h3{margin:0 0 6px;color:#14243b;font-size:22px;line-height:1.18;letter-spacing:-.025em}
      .branch-delete-header p{margin:0;color:#66758a;font-size:11px;line-height:1.55}
      .branch-delete-close{position:absolute;right:18px;top:20px;display:grid;place-items:center;width:36px;height:36px;border:1px solid #dce5ef;border-radius:11px;background:#f8fafc;color:#53647a;font-size:20px;line-height:1;cursor:pointer;transition:background .15s ease,color .15s ease,transform .15s ease}
      .branch-delete-close:hover:not(:disabled){background:#eef3f8;color:#203047;transform:rotate(3deg)}
      .branch-delete-close:focus-visible{outline:3px solid rgba(23,92,170,.18);outline-offset:2px}

      .branch-delete-form{display:grid;gap:15px;padding:0 24px 24px}
      .branch-delete-summary{display:grid;grid-template-columns:1fr auto;gap:11px 18px;padding:16px;border:1px solid #dde6f0;border-radius:14px;background:linear-gradient(145deg,#f9fbfd,#f3f7fb);box-shadow:inset 0 1px 0 #fff}
      .branch-delete-summary div{display:contents}
      .branch-delete-summary span{align-self:center;color:#6b7a8f;font-size:10px;font-weight:650}
      .branch-delete-summary strong{max-width:280px;text-align:right;color:#17283f;font-size:11px;font-weight:800;overflow-wrap:anywhere}
      .branch-delete-summary .branch-code-value{display:inline-flex;justify-self:end;padding:4px 8px;border:1px solid #cfdcea;border-radius:7px;background:#fff;color:#0c5ba7;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em}
      .branch-delete-summary .branch-status-active{color:#16713a}.branch-delete-summary .branch-status-inactive{color:#6b7280}

      .branch-delete-warning{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:start;margin:0;padding:13px 14px;border:1px solid #f0c6c2;border-radius:13px;background:#fff6f4;color:#842018;font-size:10px;line-height:1.55}
      .branch-delete-warning-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#ffe5e1;color:#b42318;font-size:15px;font-weight:900}
      .branch-delete-warning strong{display:block;margin-bottom:2px;color:#8f1d14;font-size:11px}

      .branch-delete-confirmation-label{display:grid;gap:7px;color:#25344a;font-size:10px;font-weight:750}
      .branch-delete-confirmation-label input{width:100%;height:44px;border:1px solid #cfdbea;border-radius:11px;padding:0 13px;background:#fff;color:#14243b;font:inherit;font-size:12px;font-weight:750;letter-spacing:.045em;text-transform:uppercase;transition:border-color .15s ease,box-shadow .15s ease}
      .branch-delete-confirmation-label input:focus{outline:none;border-color:#d64535;box-shadow:0 0 0 4px rgba(214,69,53,.11)}
      .branch-delete-confirmation-label input::placeholder{color:#9aa7b7;font-weight:550;letter-spacing:0;text-transform:none}
      .branch-delete-help{margin:-8px 0 0;color:#6b7a8f;font-size:9px;line-height:1.45}
      .branch-delete-help code{padding:2px 5px;border:1px solid #d8e2ee;border-radius:5px;background:#f7f9fc;color:#174f87;font:700 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      .branch-delete-message{min-height:17px;margin:-4px 0 0;color:#b42318;font-size:10px;font-weight:750;text-align:center;line-height:1.45}
      .branch-delete-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:10px;padding-top:2px}
      .branch-delete-actions .btn{min-height:42px;border-radius:11px;font-size:11px;font-weight:800}
      .btn.branch-delete-confirm{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:linear-gradient(135deg,#b42318,#d13b2e);border-color:#b42318;color:#fff;box-shadow:0 9px 20px rgba(180,35,24,.2)}
      .btn.branch-delete-confirm:hover:not(:disabled){background:linear-gradient(135deg,#941f17,#b82b20);border-color:#941f17;transform:translateY(-1px)}
      .btn.branch-delete-confirm:disabled{opacity:.62;box-shadow:none;cursor:not-allowed}
      .branch-delete-button-icon{font-size:14px;line-height:1}
      body.branch-delete-open{overflow:hidden}

      @media(max-width:620px){
        .branch-delete-backdrop{place-items:center;padding:16px}
        .branch-delete-modal{width:min(100%,500px);max-height:calc(100vh - 32px);border-radius:20px}
        .branch-delete-header{padding:24px 54px 15px 18px;gap:12px}
        .branch-delete-icon{width:43px;height:43px;flex-basis:43px;border-radius:13px}
        .branch-delete-header h3{font-size:20px}
        .branch-delete-close{right:14px;top:17px}
        .branch-delete-form{padding:0 18px 20px}
        .branch-delete-summary{padding:14px}
        .branch-delete-actions{grid-template-columns:1fr}
        .branch-delete-actions #branchDeleteCancelBtn{order:2}
      }
      @media(prefers-reduced-motion:reduce){.branch-delete-backdrop,.branch-delete-modal,.branch-delete-btn,.branch-delete-close{transition:none!important}}
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
      <section class="branch-delete-modal" role="dialog" aria-modal="true" aria-labelledby="branchDeleteTitle" aria-describedby="branchDeleteDescription">
        <header class="branch-delete-header">
          <div class="branch-delete-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
          </div>
          <div class="branch-delete-heading">
            <span class="branch-delete-eyebrow">Branch Management</span>
            <h3 id="branchDeleteTitle">Delete this branch?</h3>
            <p id="branchDeleteDescription">Review the branch details carefully before continuing.</p>
          </div>
          <button id="branchDeleteCloseBtn" class="branch-delete-close" type="button" aria-label="Close delete branch dialog">×</button>
        </header>
        <form id="branchDeleteForm" class="branch-delete-form" novalidate>
          <div id="branchDeleteSummary" class="branch-delete-summary"></div>
          <div class="branch-delete-warning">
            <span class="branch-delete-warning-icon" aria-hidden="true">!</span>
            <div><strong>This action is permanent</strong>An unused branch can be removed, but a branch connected to users or financial reports is protected and must be marked inactive instead.</div>
          </div>
          <label class="branch-delete-confirmation-label">
            Type the branch code to confirm
            <input id="branchDeleteConfirmation" type="text" maxlength="20" autocomplete="off" spellcheck="false" required />
          </label>
          <p id="branchDeleteHelp" class="branch-delete-help"></p>
          <p id="branchDeleteMessage" class="branch-delete-message" aria-live="polite"></p>
          <div class="branch-delete-actions">
            <button id="branchDeleteCancelBtn" class="btn ghost" type="button">Cancel</button>
            <button id="branchDeleteConfirmBtn" class="btn branch-delete-confirm" type="submit"><span class="branch-delete-button-icon" aria-hidden="true">×</span><span>Delete Branch</span></button>
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
    document.addEventListener('keydown', handleDialogKeyboard);
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
    const input = document.getElementById('branchDeleteConfirmation');
    if (confirm) {
      confirm.disabled = value;
      confirm.innerHTML = value
        ? '<span class="branch-delete-button-icon" aria-hidden="true">…</span><span>Deleting Branch…</span>'
        : '<span class="branch-delete-button-icon" aria-hidden="true">×</span><span>Delete Branch</span>';
    }
    if (cancel) cancel.disabled = value;
    if (close) close.disabled = value;
    if (input) input.disabled = value;
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

    lastFocusedElement = document.activeElement;
    const backdrop = ensureModal();
    const summary = document.getElementById('branchDeleteSummary');
    const code = escapeHtml(branchPendingDeletion.code);
    summary.innerHTML = `
      <div><span>Branch Code</span><strong class="branch-code-value">${code}</strong></div>
      <div><span>Branch Name</span><strong>${escapeHtml(branchPendingDeletion.name)}</strong></div>
      <div><span>Current Status</span><strong class="${branchPendingDeletion.active ? 'branch-status-active' : 'branch-status-inactive'}">${branchPendingDeletion.active ? 'Active' : 'Inactive'}</strong></div>`;

    const form = document.getElementById('branchDeleteForm');
    const input = document.getElementById('branchDeleteConfirmation');
    form.reset();
    input.placeholder = `Type ${branchPendingDeletion.code} to confirm`;
    document.getElementById('branchDeleteHelp').innerHTML = `Enter <code>${code}</code> exactly. This protects the branch from accidental deletion.`;
    setMessage('');
    setDeleting(false);
    backdrop.classList.remove('hidden');
    document.body.classList.add('branch-delete-open');
    window.setTimeout(() => input.focus(), 40);
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
    if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
    lastFocusedElement = null;
  }

  function handleDialogKeyboard(event) {
    const backdrop = document.getElementById('branchDeleteBackdrop');
    if (!backdrop || backdrop.classList.contains('hidden')) return;
    if (event.key === 'Escape' && !deleting) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...backdrop.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
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
      document.getElementById('branchDeleteConfirmation').focus();
      return;
    }

    setDeleting(true);
    setLoading(true, 'Checking branch safety and deleting…');
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
    lastFocusedElement = null;
  }

  function isDeleteButton(button) {
    const text = String(button?.textContent || '').trim().toLowerCase();
    return Boolean(button?.classList?.contains('branch-delete-btn') || text === 'delete' || text === 'delete branch');
  }

  function interceptAnyLegacyBranchDelete(event) {
    const button = event.target.closest?.('#adminBranchRows button');
    if (!button || !isDeleteButton(button)) return;
    const row = button.closest('tr[data-admin-branch-id]');
    if (!row) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openModal(row.dataset.adminBranchId);
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
      const existingDelete = [...row.querySelectorAll('button')].find(isDeleteButton);
      if (existingDelete) {
        existingDelete.classList.add('branch-delete-btn');
        existingDelete.type = 'button';
        return;
      }

      const branch = adminBranches.find((item) => item.id === row.dataset.adminBranchId);
      if (!branch) return;
      const cell = document.createElement('td');
      cell.className = 'branch-actions';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'branch-delete-btn';
      button.textContent = 'Delete';
      button.setAttribute('aria-label', `Delete branch ${branch.name}`);
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
  document.addEventListener('click', interceptAnyLegacyBranchDelete, true);
  wrapBranchRendering();
})();
