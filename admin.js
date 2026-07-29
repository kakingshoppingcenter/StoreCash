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
  admin: Object.fromEntries(PERMISSION_DEFINITIONS.map(({key}) => [key,true]))
};

let adminBranches=[];
let adminUsers=[];
let selectedAdminUserId=null;
let selectedAdminBranchId=null;

function hasPermission(key,target=profile){
  if(!target)return false;
  if(target.role==='admin')return true;
  const custom=target.permissions&&Object.prototype.hasOwnProperty.call(target.permissions,key)?target.permissions[key]:undefined;
  return typeof custom==='boolean'?custom:Boolean(ROLE_PERMISSION_DEFAULTS[target.role]?.[key]);
}
function hasAnyPermission(value,target=profile){return String(value||'').split(',').map(v=>v.trim()).filter(Boolean).some(key=>hasPermission(key,target));}

isStoreUser=function(){return Boolean(profile?.branch_id)&&!hasPermission('reports_all_branches');};
canVerify=function(){return hasPermission('checker_verify');};
canReviewAudit=function(){return hasPermission('audit_view');};

loadProfile=async function(){
  const {data,error}=await db.from('profiles').select('id,email,full_name,role,branch_id,active,permissions').eq('id',session.user.id).single();
  if(error)throw error;
  if(!data.active)throw new Error('Your account is not active. Contact the system administrator.');
  profile=data;
};

applyRoleVisibility=function(){
  document.querySelectorAll('[data-permission]').forEach(el=>el.classList.toggle('hidden',!hasAnyPermission(el.dataset.permission)));
  document.querySelectorAll('[data-roles]:not([data-permission])').forEach(el=>el.classList.toggle('hidden',!el.dataset.roles.split(',').includes(profile.role)));
  byId('profileName').textContent=profile.full_name;
  byId('profileRole').textContent=ROLE_LABELS[profile.role]||profile.role;
  byId('profileInitials').textContent=getInitials(profile.full_name);
  if(!document.querySelector(`.nav-item[data-view="${currentView}"]:not(.hidden)`))currentView=document.querySelector('.nav-item:not(.hidden)')?.dataset.view||'dashboard';
  setView(currentView);
};

setView=function(view){
  const nav=document.querySelector(`.nav-item[data-view="${view}"]:not(.hidden)`)||document.querySelector('.nav-item:not(.hidden)');
  if(!nav)return;
  currentView=nav.dataset.view;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b===nav));
  document.querySelectorAll('[data-section]').forEach(s=>s.classList.add('view-hidden'));
  const map={dashboard:['dashboard','reports','summary'],entry:['entry'],checker:['checker','reports'],reports:['reports'],summary:['summary','reports'],audit:['audit'],administration:['administration']};
  (map[currentView]||[]).forEach(name=>document.querySelectorAll(`[data-section="${name}"]`).forEach(s=>s.classList.remove('view-hidden')));
  const titles={dashboard:'Daily Operations Dashboard',entry:'Daily Store Entry',checker:'Deposit Verification',reports:'Branch Reports',summary:'Executive Summary',audit:'Audit Trail',administration:'System Administration'};
  byId('pageTitle').textContent=titles[currentView]||'KakingStoreCash';
  if(currentView==='administration')loadAdministration();
};

const baseLoadData=loadData;
loadData=async function(){await baseLoadData();if(hasAnyPermission('manage_users,manage_branches'))await loadAdministration();};

function buildPermissionEditor(){
  const groups=[...new Set(PERMISSION_DEFINITIONS.map(p=>p.group))];
  byId('permissionGrid').innerHTML=groups.map(group=>`<fieldset class="permission-group"><legend>${escapeHtml(group)}</legend>${PERMISSION_DEFINITIONS.filter(p=>p.group===group).map(p=>`<label class="permission-toggle"><input type="checkbox" data-permission-key="${p.key}"><span>${escapeHtml(p.label)}</span></label>`).join('')}</fieldset>`).join('');
}
function selectedPermissions(){const out={};document.querySelectorAll('[data-permission-key]').forEach(i=>out[i.dataset.permissionKey]=i.checked);return out;}
function applyRoleDefaults(role,overrides=null){const defs=ROLE_PERMISSION_DEFAULTS[role]||{};document.querySelectorAll('[data-permission-key]').forEach(i=>{const k=i.dataset.permissionKey;i.checked=typeof overrides?.[k]==='boolean'?overrides[k]:Boolean(defs[k]);});byId('userBranch').required=role==='store_user';}
function populateAdminBranchOptions(){byId('userBranch').innerHTML='<option value="">No assigned branch</option>'+adminBranches.map(b=>`<option value="${b.id}">${escapeHtml(b.name)}${b.active?'':' (Inactive)'}</option>`).join('');}

function renderBranchTable(){
  byId('adminBranchRows').innerHTML=adminBranches.map(b=>`<tr data-admin-branch-id="${b.id}"><td><strong>${escapeHtml(b.code)}</strong></td><td>${escapeHtml(b.name)}</td><td><span class="badge ${b.active?'matched':'neutral'}">${b.active?'Active':'Inactive'}</span></td><td>${escapeHtml(formatDateTime(b.updated_at||b.created_at))}</td></tr>`).join('')||'<tr><td colspan="4" class="empty-state">No branches configured.</td></tr>';
  document.querySelectorAll('[data-admin-branch-id]').forEach(r=>r.addEventListener('click',()=>editBranch(r.dataset.adminBranchId)));
}
function renderUserTable(){
  byId('adminUserRows').innerHTML=adminUsers.map(u=>{const b=adminBranches.find(x=>x.id===u.branch_id);return `<tr data-admin-user-id="${u.id}"><td><strong>${escapeHtml(u.full_name||'Unnamed User')}</strong><small>${escapeHtml(u.email||'')}</small></td><td>${escapeHtml(ROLE_LABELS[u.role]||u.role)}</td><td>${escapeHtml(b?.name||'All / Not Assigned')}</td><td><span class="badge ${u.active?'matched':'neutral'}">${u.active?'Active':'Inactive'}</span></td><td>${escapeHtml(formatDateTime(u.last_sign_in_at))}</td></tr>`;}).join('')||'<tr><td colspan="5" class="empty-state">No users found.</td></tr>';
  document.querySelectorAll('[data-admin-user-id]').forEach(r=>r.addEventListener('click',()=>editUser(r.dataset.adminUserId)));
}

async function invokeAdminUsers(payload){
  const {data,error}=await db.functions.invoke('admin-users',{body:payload});
  if(error){let message=error.message||'Administration request failed.';try{if(error.context?.json)message=(await error.context.json()).error||message;}catch(_){}throw new Error(message);}
  if(data?.error)throw new Error(data.error);
  return data;
}

async function loadAdministration(){
  if(!hasAnyPermission('manage_users,manage_branches')||!db||!session)return;
  try{
    const [branchResult,userResult]=await Promise.all([
      hasPermission('manage_branches')?db.from('branches').select('*').order('name'):Promise.resolve({data:branches,error:null}),
      hasPermission('manage_users')?invokeAdminUsers({action:'list_users'}):Promise.resolve({users:[]})
    ]);
    if(branchResult.error)throw branchResult.error;
    adminBranches=branchResult.data||[];adminUsers=userResult.users||[];
    populateAdminBranchOptions();renderBranchTable();renderUserTable();
  }catch(error){console.error(error);showToast(error.message||'Unable to load administration data.','error');}
}

function resetBranchForm(){selectedAdminBranchId=null;byId('branchAdminForm').reset();byId('branchActive').checked=true;byId('branchSaveBtn').textContent='Add Branch';}
function editBranch(id){const b=adminBranches.find(x=>x.id===id);if(!b)return;selectedAdminBranchId=id;byId('branchCode').value=b.code;byId('branchName').value=b.name;byId('branchActive').checked=b.active;byId('branchSaveBtn').textContent='Update Branch';byId('branchCode').focus();}
async function saveBranch(event){
  event.preventDefault();if(!hasPermission('manage_branches'))return showToast('You are not authorized to manage branches.','error');
  const payload={code:byId('branchCode').value.trim().toUpperCase(),name:byId('branchName').value.trim(),active:byId('branchActive').checked};
  if(!/^[A-Z0-9_-]{2,20}$/.test(payload.code))return showToast('Branch code must be 2–20 letters, numbers, underscores, or hyphens.','error');
  if(payload.name.length<2)return showToast('Enter a valid branch name.','error');
  setLoading(true,selectedAdminBranchId?'Updating branch…':'Adding branch…');
  try{const q=selectedAdminBranchId?db.from('branches').update(payload).eq('id',selectedAdminBranchId):db.from('branches').insert(payload);const {error}=await q;if(error)throw error;showToast(selectedAdminBranchId?'Branch updated successfully.':'Branch added successfully.','success');resetBranchForm();await loadData();}
  catch(error){console.error(error);showToast(error.message||'Unable to save branch.','error');}finally{setLoading(false);}
}

function resetUserForm(){selectedAdminUserId=null;byId('userAdminForm').reset();byId('userActive').checked=true;byId('userRole').value='store_user';byId('userPassword').required=true;byId('userPasswordHint').textContent='Required for a new user. Share it securely and ask the user to change it.';byId('userSaveBtn').textContent='Create User';applyRoleDefaults('store_user');}
function editUser(id){const u=adminUsers.find(x=>x.id===id);if(!u)return;selectedAdminUserId=id;byId('userFullName').value=u.full_name||'';byId('userEmail').value=u.email||'';byId('userPassword').value='';byId('userPassword').required=false;byId('userPasswordHint').textContent='Leave blank to keep the current password.';byId('userRole').value=u.role||'store_user';byId('userBranch').value=u.branch_id||'';byId('userActive').checked=Boolean(u.active);applyRoleDefaults(u.role,u.permissions||{});byId('userSaveBtn').textContent='Update User';byId('userFullName').focus();}
async function saveUser(event){
  event.preventDefault();if(!hasPermission('manage_users'))return showToast('You are not authorized to manage users.','error');
  const role=byId('userRole').value;
  const payload={action:selectedAdminUserId?'update_user':'create_user',user_id:selectedAdminUserId||undefined,email:byId('userEmail').value.trim().toLowerCase(),password:byId('userPassword').value||undefined,full_name:byId('userFullName').value.trim(),role,branch_id:byId('userBranch').value||null,active:byId('userActive').checked,permissions:selectedPermissions()};
  if(!payload.full_name||!payload.email)return showToast('Full name and email are required.','error');
  if(!selectedAdminUserId&&(!payload.password||payload.password.length<10))return showToast('Temporary password must contain at least 10 characters.','error');
  if(role==='store_user'&&!payload.branch_id)return showToast('A store user must be assigned to a branch.','error');
  setLoading(true,selectedAdminUserId?'Updating user…':'Creating user…');
  try{await invokeAdminUsers(payload);showToast(selectedAdminUserId?'User updated successfully.':'User created successfully.','success');resetUserForm();await loadAdministration();}
  catch(error){console.error(error);showToast(error.message||'Unable to save user.','error');}finally{setLoading(false);}
}

function bindAdministrationEvents(){
  buildPermissionEditor();
  byId('branchAdminForm').addEventListener('submit',saveBranch);byId('branchResetBtn').addEventListener('click',resetBranchForm);
  byId('userAdminForm').addEventListener('submit',saveUser);byId('userResetBtn').addEventListener('click',resetUserForm);
  byId('userRole').addEventListener('change',()=>applyRoleDefaults(byId('userRole').value));
  resetBranchForm();resetUserForm();
}
bindAdministrationEvents();
