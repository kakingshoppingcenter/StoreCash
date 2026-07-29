'use strict';

(function installProtectedAdminDeletion() {
  const DELETE_FUNCTION = 'admin-delete-user';
  const DELETE_MODAL_ID = 'adminDeleteModal';
  let deleteModalResolve = null;
  let previousBodyOverflow = '';

  function installDeleteStyles() {
    if (document.getElementById('adminDeleteRuntimeStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminDeleteRuntimeStyles';
    style.textContent = `
      .btn.danger-action{background:#b42318;border-color:#b42318;color:#fff;box-shadow:0 6px 14px rgba(180,35,24,.18)}
      .btn.danger-action:hover:not(:disabled){background:#912018;border-color:#912018}
      .btn.danger-action:disabled{background:#e5a9a4;border-color:#e5a9a4;color:#fff;box-shadow:none;cursor:not-allowed}
      #userDeleteBtn{margin-right:auto}
      body.admin-delete-modal-open{overflow:hidden}
      .admin-delete-modal{position:fixed;inset:0;z-index:40000;display:grid;place-items:center;padding:24px;isolation:isolate}
      .admin-delete-modal.hidden{display:none}
      .admin-delete-backdrop{position:absolute;inset:0;background:rgba(8,18,32,.66);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      .admin-delete-dialog{position:relative;width:min(560px,100%);max-height:min(760px,calc(100vh - 48px));overflow:auto;background:#fff;border:1px solid rgba(15,41,69,.1);border-radius:24px;box-shadow:0 34px 90px rgba(5,24,47,.34);animation:adminDeleteDialogIn .18s ease-out}
      .admin-delete-header{display:flex;align-items:flex-start;gap:14px;padding:24px 24px 18px;border-bottom:1px solid #edf1f5}
      .admin-delete-icon{width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border-radius:14px;background:#fff1f0;color:#b42318;border:1px solid #ffd6d2;font-size:22px;font-weight:800}
      .admin-delete-heading{min-width:0;flex:1}
      .admin-delete-heading h2{margin:0;color:#132238;font-size:21px;line-height:1.25;letter-spacing:-.02em}
      .admin-delete-heading p{margin:6px 0 0;color:#667085;font-size:13px;line-height:1.5}
      .admin-delete-close{width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:#667085;font-size:24px;line-height:1;cursor:pointer}
      .admin-delete-close:hover{background:#f2f4f7;color:#101828}
      .admin-delete-body{padding:22px 24px 6px}
      .admin-delete-warning{display:flex;gap:11px;padding:14px 15px;border:1px solid #fed7d3;background:#fff7f6;border-radius:14px;color:#7a271a;font-size:13px;line-height:1.55}
      .admin-delete-warning strong{display:block;margin-bottom:2px;color:#912018}
      .admin-delete-account{margin-top:18px;padding:15px;border:1px solid #e5eaf0;border-radius:15px;background:#f8fafc}
      .admin-delete-account-title{margin:0 0 11px;color:#344054;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .admin-delete-details{display:grid;grid-template-columns:1fr 1fr;gap:11px 16px}
      .admin-delete-detail{min-width:0}
      .admin-delete-detail span{display:block;color:#667085;font-size:11px;margin-bottom:3px}
      .admin-delete-detail strong{display:block;color:#172033;font-size:13px;line-height:1.35;overflow-wrap:anywhere}
      .admin-delete-confirm{margin-top:18px}
      .admin-delete-confirm label{display:block;margin-bottom:7px;color:#344054;font-size:13px;font-weight:700}
      .admin-delete-confirm .instruction{margin:0 0 10px;color:#667085;font-size:12px;line-height:1.5}
      .admin-delete-confirm .expected-email{font-weight:800;color:#344054;overflow-wrap:anywhere}
      .admin-delete-confirm input{width:100%;height:44px;padding:0 13px;border:1px solid #cfd7e3;border-radius:11px;background:#fff;color:#172033;font:inherit;outline:none;transition:border-color .16s,box-shadow .16s}
      .admin-delete-confirm input:focus{border-color:#1f6feb;box-shadow:0 0 0 4px rgba(31,111,235,.12)}
      .admin-delete-confirm input.invalid{border-color:#d92d20;box-shadow:0 0 0 4px rgba(217,45,32,.1)}
      .admin-delete-message{min-height:19px;margin:7px 0 0;color:#d92d20;font-size:12px}
      .admin-delete-actions{display:flex;justify-content:flex-end;gap:10px;padding:18px 24px 24px}
      .admin-delete-actions button{min-width:112px;height:42px;border-radius:11px;font-weight:700;cursor:pointer}
      .admin-delete-cancel{border:1px solid #d0d5dd;background:#fff;color:#344054}
      .admin-delete-cancel:hover{background:#f8fafc}
      .admin-delete-confirm-btn{border:1px solid #b42318;background:#b42318;color:#fff;box-shadow:0 6px 14px rgba(180,35,24,.18)}
      .admin-delete-confirm-btn:hover:not(:disabled){background:#912018;border-color:#912018}
      .admin-delete-confirm-btn:disabled{border-color:#f0b7b2;background:#f0b7b2;box-shadow:none;cursor:not-allowed}
      @keyframes adminDeleteDialogIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
      @media(max-width:760px){
        #userDeleteBtn{margin-right:0;order:3}
        .admin-delete-modal{padding:14px}
        .admin-delete-dialog{border-radius:20px;max-height:calc(100vh - 28px)}
        .admin-delete-header,.admin-delete-body,.admin-delete-actions{padding-left:18px;padding-right:18px}
        .admin-delete-details{grid-template-columns:1fr}
        .admin-delete-actions{flex-direction:column-reverse}
        .admin-delete-actions button{width:100%}
      }
      @media(prefers-reduced-motion:reduce){.admin-delete-dialog{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureDeleteButton() {
    let button = byId('userDeleteBtn');
    if (button) return button;

    const actions = byId('userSaveBtn')?.parentElement;
    if (!actions) return null;

    button = document.createElement('button');
    button.id = 'userDeleteBtn';
    button.className = 'btn danger-action hidden';
    button.type = 'button';
    button.textContent = 'Delete User';
    actions.insertBefore(button, actions.firstChild);
    button.addEventListener('click', deleteSelectedUser);
    return button;
  }

  function normalizeRole(value) {
    return String(value || 'Not assigned')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function resolveBranchLabel(user) {
    const direct = user?.branch_name || user?.branch_code || user?.branch_id;
    if (direct) return String(direct);
    if (typeof user?.branch === 'string') return user.branch;
    if (user?.branch?.name) return user.branch.name;
    if (user?.branches?.name) return user.branches.name;
    return 'Not assigned';
  }

  function ensureDeleteModal() {
    let modal = document.getElementById(DELETE_MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = DELETE_MODAL_ID;
    modal.className = 'admin-delete-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="admin-delete-backdrop" data-delete-dismiss="true"></div>
      <section class="admin-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="adminDeleteTitle" aria-describedby="adminDeleteDescription">
        <header class="admin-delete-header">
          <div class="admin-delete-icon" aria-hidden="true">!</div>
          <div class="admin-delete-heading">
            <h2 id="adminDeleteTitle">Delete this user?</h2>
            <p id="adminDeleteDescription">Review the account carefully before permanently removing it.</p>
          </div>
          <button class="admin-delete-close" type="button" data-delete-dismiss="true" aria-label="Close deletion confirmation">×</button>
        </header>
        <div class="admin-delete-body">
          <div class="admin-delete-warning">
            <div aria-hidden="true">⚠</div>
            <div><strong>Permanent account deletion</strong>This removes the Supabase login and system profile and cannot be undone. Accounts connected to financial records must be deactivated instead.</div>
          </div>
          <div class="admin-delete-account">
            <p class="admin-delete-account-title">Account selected for deletion</p>
            <div class="admin-delete-details">
              <div class="admin-delete-detail"><span>Full name</span><strong data-delete-name>—</strong></div>
              <div class="admin-delete-detail"><span>Email address</span><strong data-delete-email>—</strong></div>
              <div class="admin-delete-detail"><span>Role</span><strong data-delete-role>—</strong></div>
              <div class="admin-delete-detail"><span>Assigned branch</span><strong data-delete-branch>—</strong></div>
            </div>
          </div>
          <div class="admin-delete-confirm">
            <label for="adminDeleteEmailInput">Confirm the email address</label>
            <p class="instruction">Type <span class="expected-email" data-delete-expected-email></span> exactly to enable deletion.</p>
            <input id="adminDeleteEmailInput" type="email" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Enter the user email address" />
            <p class="admin-delete-message" data-delete-message aria-live="polite"></p>
          </div>
        </div>
        <footer class="admin-delete-actions">
          <button class="admin-delete-cancel" type="button" data-delete-dismiss="true">Cancel</button>
          <button class="admin-delete-confirm-btn" type="button" data-delete-confirm disabled>Delete User</button>
        </footer>
      </section>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector('#adminDeleteEmailInput');
    const confirmButton = modal.querySelector('[data-delete-confirm]');
    const message = modal.querySelector('[data-delete-message]');

    function syncConfirmationState() {
      const expected = modal.dataset.expectedEmail || '';
      const entered = input.value.trim().toLowerCase();
      const matches = Boolean(expected) && entered === expected;
      confirmButton.disabled = !matches;
      input.classList.toggle('invalid', Boolean(entered) && !matches);
      message.textContent = entered && !matches ? 'The email address does not match the selected account.' : '';
    }

    input.addEventListener('input', syncConfirmationState);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !confirmButton.disabled) {
        event.preventDefault();
        confirmButton.click();
      }
    });

    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-delete-dismiss="true"]')) {
        closeDeleteConfirmation(null);
      }
    });

    confirmButton.addEventListener('click', () => {
      if (confirmButton.disabled) return;
      closeDeleteConfirmation(input.value.trim().toLowerCase());
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeDeleteConfirmation(null);
      }
    });

    return modal;
  }

  function closeDeleteConfirmation(value) {
    const modal = document.getElementById(DELETE_MODAL_ID);
    if (!modal || modal.classList.contains('hidden')) return;

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('admin-delete-modal-open');
    document.body.style.overflow = previousBodyOverflow;

    const resolver = deleteModalResolve;
    deleteModalResolve = null;
    if (resolver) resolver(value);
  }

  function openDeleteConfirmation(user) {
    const modal = ensureDeleteModal();
    const email = String(user?.email || '').trim().toLowerCase();
    const input = modal.querySelector('#adminDeleteEmailInput');
    const confirmButton = modal.querySelector('[data-delete-confirm]');
    const message = modal.querySelector('[data-delete-message]');

    modal.dataset.expectedEmail = email;
    modal.querySelector('[data-delete-name]').textContent = user?.full_name || user?.name || 'Unnamed user';
    modal.querySelector('[data-delete-email]').textContent = email || 'No email address';
    modal.querySelector('[data-delete-role]').textContent = normalizeRole(user?.role);
    modal.querySelector('[data-delete-branch]').textContent = resolveBranchLabel(user);
    modal.querySelector('[data-delete-expected-email]').textContent = email;

    input.value = '';
    input.classList.remove('invalid');
    confirmButton.disabled = true;
    message.textContent = '';

    previousBodyOverflow = document.body.style.overflow;
    document.body.classList.add('admin-delete-modal-open');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    window.requestAnimationFrame(() => input.focus());

    return new Promise((resolve) => {
      deleteModalResolve = resolve;
    });
  }

  function selectedUser() {
    return adminUsers.find((item) => item.id === selectedAdminUserId) || null;
  }

  function updateDeleteButton() {
    const button = ensureDeleteButton();
    if (!button) return;

    const user = selectedUser();
    const isAdministrator = profile?.role === 'admin';
    button.classList.toggle('hidden', !user || !isAdministrator);
    if (!user || !isAdministrator) return;

    const isSelf = user.id === session?.user?.id;
    const unavailable = userServiceState !== 'ready';
    button.disabled = isSelf || unavailable;
    button.title = isSelf
      ? 'You cannot delete the account currently signed in.'
      : unavailable
        ? 'The secure user-management service must be connected first.'
        : 'Permanently delete this unused account.';
  }

  function friendlyDeleteError(error) {
    const raw = error?.message || 'Unable to delete the user.';
    if (/financial records|submitted reports|deposit verifications/i.test(raw)) {
      return `${raw} Deactivate the account instead to preserve financial history.`;
    }
    if (/last active administrator/i.test(raw)) {
      return `${raw} Create or activate another administrator first.`;
    }
    if (/failed to send a request|failed to fetch|networkerror|function not found|404/i.test(raw)) {
      return 'The secure deletion service is not deployed or reachable. Deploy the Supabase Edge Function named admin-delete-user.';
    }
    return typeof friendlyFunctionError === 'function' ? friendlyFunctionError(error) : raw;
  }

  async function invokeDeleteUser(payload) {
    const { data, error } = await db.functions.invoke(DELETE_FUNCTION, { body: payload });
    if (error) {
      let message = friendlyDeleteError(error);
      try {
        if (error.context?.json) {
          const details = await error.context.json();
          message = details.error || message;
        }
      } catch (_) {
        // Keep the clear fallback message.
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function deleteSelectedUser() {
    if (profile?.role !== 'admin') {
      showToast('Only a system administrator can permanently delete users.', 'error');
      return;
    }

    const user = selectedUser();
    if (!user) {
      showToast('Select a user before using Delete User.', 'error');
      return;
    }
    if (user.id === session?.user?.id) {
      showToast('You cannot delete the account currently signed in.', 'error');
      return;
    }
    if (userServiceState !== 'ready') {
      showToast('Connect the secure user-management service before deleting a user.', 'error');
      return;
    }

    const email = String(user.email || '').trim().toLowerCase();
    if (!email) {
      showToast('This account has no email address and cannot be safely confirmed for deletion.', 'error');
      return;
    }

    const confirmation = await openDeleteConfirmation(user);
    if (confirmation === null) return;
    if (confirmation !== email) {
      showToast('Deletion cancelled because the confirmation email did not match.', 'error');
      return;
    }

    setLoading(true, 'Checking account safety and deleting user…');
    try {
      await invokeDeleteUser({
        action: 'delete_user',
        user_id: user.id,
        confirmation_email: confirmation
      });
      showToast(`${user.full_name || user.email || 'User'} was deleted successfully.`, 'success');
      resetUserForm();
      await loadUserAdministration(true);
    } catch (error) {
      console.error(error);
      showToast(friendlyDeleteError(error), 'error');
    } finally {
      setLoading(false);
      updateDeleteButton();
    }
  }

  function wrapAdministrationFunctions() {
    const originalEditUser = editUser;
    editUser = function (id) {
      originalEditUser(id);
      updateDeleteButton();
    };

    const originalResetUserForm = resetUserForm;
    resetUserForm = function () {
      originalResetUserForm();
      updateDeleteButton();
    };

    const originalSetUserFormEnabled = setUserFormEnabled;
    setUserFormEnabled = function (enabled) {
      originalSetUserFormEnabled(enabled);
      updateDeleteButton();
    };

    const originalLoadUserAdministration = loadUserAdministration;
    loadUserAdministration = async function (forceRetry = false) {
      const result = await originalLoadUserAdministration(forceRetry);
      updateDeleteButton();
      return result;
    };
  }

  installDeleteStyles();
  ensureDeleteButton();
  ensureDeleteModal();
  wrapAdministrationFunctions();
  updateDeleteButton();
})();
