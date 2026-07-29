'use strict';

const PERMISSION_DEFINITIONS = [
  { key: 'dashboard_view', label: 'View dashboard', group: 'Viewing' },
  { key: 'entry_view', label: 'View daily entry', group: 'Daily Entry' },
  { key: 'entry_create', label: 'Create and submit reports', group: 'Daily Entry' },
  { key: 'checker_view', label: 'View deposit checker', group: 'Deposit Checking' },
  { key: 'checker_verify', label: 'Verify deposits', group: 'Deposit Checking' },
  { key: 'reports_view', label: 'View branch reports', group: 'Reports' },
  { key: 'reports_all_branches', label: 'View all branches', group: 'Reports' },
  { key: 'reports_manage', label: 'Reopen and manage reports', group: 'Reports' },
  { key: 'summary_view', label: 'View executive summary', group: 'Viewing' },
  { key: 'audit_view', label: 'View audit trail', group: 'Viewing' },
  { key: 'export_data', label: 'Export report data', group: 'Reports' },
  { key: 'manage_branches', label: 'Manage branches', group: 'Administration' },
  { key: 'manage_users', label: 'Manage users and permissions', group: 'Administration' }
];

const ROLE_PERMISSION_DEFAULTS = {
  store_user: { dashboard_view:true,entry_view:true,entry_create:true,checker_view:false,checker_verify:false,reports_view:true,reports_all_branches:false,reports_manage:false,summary_view:false,audit_view:false,export_data:false,manage_branches:false,manage_users:false },
  checker: { dashboard_view:true,entry_view:false,entry_create:false,checker_view:true,checker_verify:true,reports_view:true,reports_all_branches:true,reports_manage:false,summary_view:true,audit_view:false,export_data:true,manage_branches:false,manage_users:false },
  executive: { dashboard_view:true,entry_view:false,entry_create:false,checker_view:false,checker_verify:false,reports_view:true,reports_all_branches:true,reports_manage:false,summary_view:true,audit_view:true,export_data:true,manage_branches:false,manage_users:false },
  admin: Object.fromEntries(PERMISSION_DEFINITIONS.map(({ key }) => [key, true]))
};

let adminBranches = [];
let adminUsers = [];
let selectedAdminUserId = null;
let selectedAdminBranchId = null;
let administrationExtensionReady = true;

function hasPermission(key, target = profile) {
  if (!target) return false;
  if (target.role === 'admin') return true;
  const custom = target.permissions && Object.prototype.hasOwnProperty.call(target.permissions, key)
    ? target.permissions[key]
    : undefined;
  return typeof custom === 'boolean' ? custom : Boolean(ROLE_PERMISSION_DEFAULTS[target.role]?.[key]);
}

function hasAnyPermission(value, target = profile) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .some((key) => hasPermission(key, target));
}

isStoreUser = function () { return Boolean(profile?.branch_id) && !hasPermission('reports_all_branches'); };
canVerify = function () { return hasPermission('checker_verify'); };
canReviewAudit = function () { return hasPermission('audit_view'); };

function isMissingAdminExtensionError(error) {
  return /column .*?(email|permissions).*?does not exist|could not find.*?(email|permissions).*?column|schema cache/i.test(error?.message || '');
}

loadProfile = async function () {
  let result = await db
    .from('profiles')
    .select('id,email,full_name,role,branch_id,active,permissions')
    .eq('id', session.user.id)
    .maybeSingle();

  if (result.error && isMissingAdminExtensionError(result.error)) {
    administrationExtensionReady = false;
    result = await db
      .from('profiles')
      .select('id,full_name,role,branch_id,active')
      .eq('id', session.user.id)
      .maybeSingle();

    if (result.data) {
      result.data.email = session.user.email || '';
      result.data.permissions = {};
    }
  }

  if (result.error) throw result.error;
  if (!result.data) throw new Error('Your login is valid, but no system profile is assigned to this account. Ask an administrator to create or repair your profile.');
  if (!result.data.active) throw new Error('Your login is valid, but your system account is inactive. Ask an administrator to activate it.');

  profile = {
    ...result.data,
    email: result.data.email || session.user.email || '',
    permissions: result.data.permissions || {}
  };
};

applyRoleVisibility = function () {
  document.querySelectorAll('[data-permission]').forEach((element) => {
    element.classList.toggle('hidden', !hasAnyPermission(element.dataset.permission));
  });
  document.querySelectorAll('[data-roles]:not([data-permission])').forEach((element) => {
    element.classList.toggle('hidden', !element.dataset.roles.split(',').includes(profile.role));
  });
  byId('profileName').textContent = profile.full_name;
  byId('profileRole').textContent = ROLE_LABELS[profile.role] || profile.role;
  byId('profileInitials').textContent = getInitials(profile.full_name);

  if (!document.querySelector(`.nav-item[data-view="${currentView}"]:not(.hidden)`)) {
    currentView = document.querySelector('.nav-item:not(.hidden)')?.dataset.view || 'dashboard';
  }
  setView(currentView);
};

setView = function (view) {
  const nav = document.querySelector(`.nav-item[data-view="${view}"]:not(.hidden)`) || document.querySelector('.nav-item:not(.hidden)');
  if (!nav) return;

  currentView = nav.dataset.view;
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button === nav));
  document.querySelectorAll('[data-section]').forEach((section) => section.classList.add('view-hidden'));

  const sections = {
    dashboard: ['dashboard', 'reports', 'summary'],
    entry: ['entry'],
    checker: ['checker', 'reports'],
    reports: ['reports'],
    summary: ['summary', 'reports'],
    audit: ['audit'],
    administration: ['administration']
  };
  (sections[currentView] || []).forEach((name) => {
    document.querySelectorAll(`[data-section="${name}"]`).forEach((section) => section.classList.remove('view-hidden'));
  });

  const titles = {
    dashboard: 'Daily Operations Dashboard',
    entry: 'Daily Store Entry',
    checker: 'Deposit Verification',
    reports: 'Branch Reports',
    summary: 'Executive Summary',
    audit: 'Audit Trail',
    administration: 'System Administration'
  };
  byId('pageTitle').textContent = titles[currentView] || 'Kaking Store Cash';

  // User listing is intentionally loaded only when Administration is opened.
  if (currentView === 'administration') loadAdministration();
};

function buildPermissionEditor() {
  const groups = [...new Set(PERMISSION_DEFINITIONS.map((permission) => permission.group))];
  byId('permissionGrid').innerHTML = groups.map((group) =>
    `<fieldset class="permission-group"><legend>${escapeHtml(group)}</legend>${PERMISSION_DEFINITIONS
      .filter((permission) => permission.group === group)
      .map((permission) => `<label class="permission-toggle"><input type="checkbox" data-permission-key="${permission.key}"><span>${escapeHtml(permission.label)}</span></label>`)
      .join('')}</fieldset>`
  ).join('');
}

function selectedPermissions() {
  const permissions = {};
  document.querySelectorAll('[data-permission-key]').forEach((input) => {
    permissions[input.dataset.permissionKey] = input.checked;
  });
  return permissions;
}

function applyRoleDefaults(role, overrides = null) {
  const defaults = ROLE_PERMISSION_DEFAULTS[role] || {};
  document.querySelectorAll('[data-permission-key]').forEach((input) => {
    const key = input.dataset.permissionKey;
    input.checked = typeof overrides?.[key] === 'boolean' ? overrides[key] : Boolean(defaults[key]);
  });
  byId('userBranch').required = role === 'store_user';
}

function populateAdminBranchOptions() {
  byId('userBranch').innerHTML = '<option value="">No assigned branch</option>' + adminBranches
    .map((branch) => `<option value="${branch.id}">${escapeHtml(branch.name)}${branch.active ? '' : ' (Inactive)'}</option>`)
    .join('');
}

function renderBranchTable() {
  byId('adminBranchRows').innerHTML = adminBranches.map((branch) =>
    `<tr data-admin-branch-id="${branch.id}"><td><strong>${escapeHtml(branch.code)}</strong></td><td>${escapeHtml(branch.name)}</td><td><span class="badge ${branch.active ? 'matched' : 'neutral'}">${branch.active ? 'Active' : 'Inactive'}</span></td><td>${escapeHtml(formatDateTime(branch.updated_at || branch.created_at))}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="empty-state">No branches configured.</td></tr>';

  document.querySelectorAll('[data-admin-branch-id]').forEach((row) => {
    row.addEventListener('click', () => editBranch(row.dataset.adminBranchId));
  });
}

function renderUserTable(message = '') {
  if (message) {
    byId('adminUserRows').innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(message)}</td></tr>`;
    return;
  }

  byId('adminUserRows').innerHTML = adminUsers.map((user) => {
    const branch = adminBranches.find((item) => item.id === user.branch_id);
    return `<tr data-admin-user-id="${user.id}"><td><strong>${escapeHtml(user.full_name || 'Unnamed User')}</strong><small>${escapeHtml(user.email || '')}</small></td><td>${escapeHtml(ROLE_LABELS[user.role] || user.role)}</td><td>${escapeHtml(branch?.name || 'All / Not Assigned')}</td><td><span class="badge ${user.active ? 'matched' : 'neutral'}">${user.active ? 'Active' : 'Inactive'}</span></td><td>${escapeHtml(formatDateTime(user.last_sign_in_at))}</td></tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-state">No users found.</td></tr>';

  document.querySelectorAll('[data-admin-user-id]').forEach((row) => {
    row.addEventListener('click', () => editUser(row.dataset.adminUserId));
  });
}

function friendlyFunctionError(error) {
  const raw = error?.message || 'Administration request failed.';
  if (/failed to send a request|failed to fetch|networkerror|function not found|404/i.test(raw)) {
    return 'User management service is not deployed or reachable. Deploy the Supabase Edge Function named admin-users, then sign in again.';
  }
  return raw;
}

async function invokeAdminUsers(payload) {
  const { data, error } = await db.functions.invoke('admin-users', { body: payload });
  if (error) {
    let message = friendlyFunctionError(error);
    try {
      if (error.context?.json) {
        const details = await error.context.json();
        message = details.error || message;
      }
    } catch (_) {
      // Preserve the friendly network/deployment message.
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function loadAdministration() {
  if (!administrationExtensionReady) {
    showToast('Run supabase/admin_extension.sql before using administration.', 'error');
    return;
  }
  if (!hasAnyPermission('manage_users,manage_branches') || !db || !session) return;

  // Branch management remains available even if the user Edge Function is offline.
  if (hasPermission('manage_branches')) {
    const branchResult = await db.from('branches').select('*').order('name');
    if (branchResult.error) {
      console.error(branchResult.error);
      showToast(branchResult.error.message || 'Unable to load branches.', 'error');
    } else {
      adminBranches = branchResult.data || [];
      populateAdminBranchOptions();
      renderBranchTable();
    }
  }

  if (hasPermission('manage_users')) {
    renderUserTable('Loading authorized users…');
    try {
      const result = await invokeAdminUsers({ action: 'list_users' });
      adminUsers = result.users || [];
      renderUserTable();
    } catch (error) {
      console.error(error);
      const message = friendlyFunctionError(error);
      renderUserTable(message);
      showToast(message, 'error');
    }
  }
}

function resetBranchForm() {
  selectedAdminBranchId = null;
  byId('branchAdminForm').reset();
  byId('branchActive').checked = true;
  byId('branchSaveBtn').textContent = 'Add Branch';
}

function editBranch(id) {
  const branch = adminBranches.find((item) => item.id === id);
  if (!branch) return;
  selectedAdminBranchId = id;
  byId('branchCode').value = branch.code;
  byId('branchName').value = branch.name;
  byId('branchActive').checked = branch.active;
  byId('branchSaveBtn').textContent = 'Update Branch';
  byId('branchCode').focus();
}

async function saveBranch(event) {
  event.preventDefault();
  if (!hasPermission('manage_branches')) return showToast('You are not authorized to manage branches.', 'error');

  const payload = {
    code: byId('branchCode').value.trim().toUpperCase(),
    name: byId('branchName').value.trim(),
    active: byId('branchActive').checked
  };

  if (!/^[A-Z0-9_-]{2,20}$/.test(payload.code)) return showToast('Branch code must be 2–20 letters, numbers, underscores, or hyphens.', 'error');
  if (payload.name.length < 2) return showToast('Enter a valid branch name.', 'error');

  setLoading(true, selectedAdminBranchId ? 'Updating branch…' : 'Adding branch…');
  try {
    const query = selectedAdminBranchId
      ? db.from('branches').update(payload).eq('id', selectedAdminBranchId)
      : db.from('branches').insert(payload);
    const { error } = await query;
    if (error) throw error;
    showToast(selectedAdminBranchId ? 'Branch updated successfully.' : 'Branch added successfully.', 'success');
    resetBranchForm();
    await loadData();
    await loadAdministration();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Unable to save branch.', 'error');
  } finally {
    setLoading(false);
  }
}

function resetUserForm() {
  selectedAdminUserId = null;
  byId('userAdminForm').reset();
  byId('userActive').checked = true;
  byId('userRole').value = 'store_user';
  byId('userPassword').required = true;
  byId('userPasswordHint').textContent = 'Required for a new user. Share it securely and ask the user to change it.';
  byId('userSaveBtn').textContent = 'Create User';
  applyRoleDefaults('store_user');
}

function editUser(id) {
  const user = adminUsers.find((item) => item.id === id);
  if (!user) return;
  selectedAdminUserId = id;
  byId('userFullName').value = user.full_name || '';
  byId('userEmail').value = user.email || '';
  byId('userPassword').value = '';
  byId('userPassword').required = false;
  byId('userPasswordHint').textContent = 'Leave blank to keep the current password.';
  byId('userRole').value = user.role || 'store_user';
  byId('userBranch').value = user.branch_id || '';
  byId('userActive').checked = Boolean(user.active);
  applyRoleDefaults(user.role, user.permissions || {});
  byId('userSaveBtn').textContent = 'Update User';
  byId('userFullName').focus();
}

async function saveUser(event) {
  event.preventDefault();
  if (!hasPermission('manage_users')) return showToast('You are not authorized to manage users.', 'error');

  const role = byId('userRole').value;
  const payload = {
    action: selectedAdminUserId ? 'update_user' : 'create_user',
    user_id: selectedAdminUserId || undefined,
    email: byId('userEmail').value.trim().toLowerCase(),
    password: byId('userPassword').value || undefined,
    full_name: byId('userFullName').value.trim(),
    role,
    branch_id: byId('userBranch').value || null,
    active: byId('userActive').checked,
    permissions: selectedPermissions()
  };

  if (!payload.full_name || !payload.email) return showToast('Full name and email are required.', 'error');
  if (!selectedAdminUserId && (!payload.password || payload.password.length < 10)) return showToast('Temporary password must contain at least 10 characters.', 'error');
  if (role === 'store_user' && !payload.branch_id) return showToast('A store user must be assigned to a branch.', 'error');

  setLoading(true, selectedAdminUserId ? 'Updating user…' : 'Creating user…');
  try {
    await invokeAdminUsers(payload);
    showToast(selectedAdminUserId ? 'User updated successfully.' : 'User created successfully.', 'success');
    resetUserForm();
    await loadAdministration();
  } catch (error) {
    console.error(error);
    showToast(friendlyFunctionError(error), 'error');
  } finally {
    setLoading(false);
  }
}

function bindAdministrationEvents() {
  buildPermissionEditor();
  byId('branchAdminForm').addEventListener('submit', saveBranch);
  byId('branchResetBtn').addEventListener('click', resetBranchForm);
  byId('userAdminForm').addEventListener('submit', saveUser);
  byId('userResetBtn').addEventListener('click', resetUserForm);
  byId('userRole').addEventListener('change', () => applyRoleDefaults(byId('userRole').value));
  resetBranchForm();
  resetUserForm();
}

bindAdministrationEvents();
