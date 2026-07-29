'use strict';

(function installProtectedAdminDeletion() {
  const DELETE_FUNCTION = 'admin-delete-user';

  function installDeleteStyles() {
    if (document.getElementById('adminDeleteRuntimeStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminDeleteRuntimeStyles';
    style.textContent = `
      .btn.danger-action{background:#b42318;border-color:#b42318;color:#fff;box-shadow:0 6px 14px rgba(180,35,24,.18)}
      .btn.danger-action:hover:not(:disabled){background:#912018;border-color:#912018}
      .btn.danger-action:disabled{background:#e5a9a4;border-color:#e5a9a4;color:#fff;box-shadow:none;cursor:not-allowed}
      #userDeleteBtn{margin-right:auto}
      @media(max-width:760px){#userDeleteBtn{margin-right:0;order:3}}
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
    const confirmation = window.prompt(
      `Permanent account deletion\n\nThis action removes the Supabase login and system profile. It cannot be undone. Accounts connected to financial records cannot be deleted and must be deactivated instead.\n\nType the user's email exactly to continue:\n${email}`
    );

    if (confirmation === null) return;
    if (confirmation.trim().toLowerCase() !== email) {
      showToast('Deletion cancelled because the confirmation email did not match.', 'error');
      return;
    }

    setLoading(true, 'Checking account safety and deleting user…');
    try {
      await invokeDeleteUser({
        action: 'delete_user',
        user_id: user.id,
        confirmation_email: confirmation.trim().toLowerCase()
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
  wrapAdministrationFunctions();
  updateDeleteButton();
})();
