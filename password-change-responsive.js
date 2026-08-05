'use strict';

(function improvePasswordChangePlacement() {
  if (window.__KSC_PASSWORD_ACTION_LAYOUT_V2__) return;
  window.__KSC_PASSWORD_ACTION_LAYOUT_V2__ = true;

  const LOCK_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2"></rect>
      <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
      <path d="M12 14v2"></path>
    </svg>`;

  const SIGN_OUT_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"></path>
      <path d="M14 8l4 4-4 4"></path>
      <path d="M9 12h9"></path>
    </svg>`;

  function installStyles() {
    let style = document.getElementById('passwordChangeResponsiveStyles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'passwordChangeResponsiveStyles';
      document.head.appendChild(style);
    }

    style.textContent = `
      .profile.password-change-enabled{
        display:grid!important;
        grid-template-columns:40px minmax(0,1fr)!important;
        grid-template-rows:auto auto!important;
        align-items:center!important;
        gap:10px 11px!important;
      }
      .profile.password-change-enabled>.avatar{grid-column:1!important;grid-row:1!important}
      .profile.password-change-enabled>.profile-copy{grid-column:2!important;grid-row:1!important}
      .profile-actions{
        grid-column:1/-1!important;
        grid-row:2!important;
        display:grid!important;
        grid-template-columns:minmax(0,1.35fr) minmax(0,.85fr)!important;
        gap:8px!important;
        width:100%!important;
        margin-top:2px!important;
      }
      .profile-action-button{
        width:100%!important;
        min-width:0!important;
        height:40px!important;
        min-height:40px!important;
        padding:0 10px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:7px!important;
        border:1px solid #2d4969!important;
        border-radius:11px!important;
        background:rgba(255,255,255,.04)!important;
        color:#dce7f4!important;
        font:inherit!important;
        font-size:9.5px!important;
        font-weight:750!important;
        line-height:1.1!important;
        white-space:nowrap!important;
        cursor:pointer!important;
        box-shadow:none!important;
      }
      .profile-action-button:hover:not(:disabled){
        transform:translateY(-1px)!important;
        border-color:#456789!important;
        background:rgba(255,255,255,.095)!important;
        color:#fff!important;
      }
      .profile-action-button:focus-visible{
        outline:3px solid rgba(59,130,246,.42)!important;
        outline-offset:2px!important;
      }
      .profile-action-button svg{
        width:15px!important;
        height:15px!important;
        flex:0 0 15px!important;
        fill:none!important;
        stroke:currentColor!important;
        stroke-width:1.8!important;
        stroke-linecap:round!important;
        stroke-linejoin:round!important;
      }
      .profile-action-label{display:inline-block!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #logoutBtn.profile-action-button{
        color:#ffd9d5!important;
        border-color:rgba(239,129,119,.32)!important;
        background:rgba(180,35,24,.08)!important;
      }
      #changePasswordMobileBtn,.password-change-mobile{display:none!important}

      @media(max-width:1120px){
        .profile.password-change-enabled{
          display:flex!important;
          grid-template-columns:none!important;
          grid-template-rows:none!important;
          gap:7px!important;
        }
        .profile-actions{
          display:flex!important;
          width:auto!important;
          margin:0!important;
          gap:7px!important;
        }
        .profile-action-button{
          display:inline-flex!important;
          width:40px!important;
          min-width:40px!important;
          height:40px!important;
          flex:0 0 40px!important;
          padding:0!important;
        }
        .profile-action-label{display:none!important}
      }
    `;
  }

  function decorateButton(button, icon, label, title) {
    if (!button) return;
    button.classList.add('profile-action-button');
    button.title = title;
    button.setAttribute('aria-label', title);
    if (button.dataset.profileActionLabel !== label) {
      button.innerHTML = `${icon}<span class="profile-action-label">${label}</span>`;
      button.dataset.profileActionLabel = label;
    }
  }

  function applyProfileActions() {
    installStyles();

    const duplicate = document.getElementById('changePasswordMobileBtn');
    if (duplicate) {
      duplicate.hidden = true;
      duplicate.setAttribute('aria-hidden', 'true');
      duplicate.tabIndex = -1;
    }

    const passwordButton = document.getElementById('changePasswordBtn');
    const logoutButton = document.getElementById('logoutBtn');
    const profileArea = logoutButton?.closest('.profile');
    if (!passwordButton || !logoutButton || !profileArea) return false;

    profileArea.classList.add('password-change-enabled');
    let actions = profileArea.querySelector('.profile-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'profile-actions';
      actions.setAttribute('aria-label', 'Account actions');
      profileArea.appendChild(actions);
    }

    decorateButton(passwordButton, LOCK_ICON, 'Change Password', 'Change Password');
    decorateButton(logoutButton, SIGN_OUT_ICON, 'Sign Out', 'Sign Out');

    if (passwordButton.parentElement !== actions) actions.appendChild(passwordButton);
    if (logoutButton.parentElement !== actions) actions.appendChild(logoutButton);
    return true;
  }

  applyProfileActions();

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (applyProfileActions() || attempts >= 40) window.clearInterval(timer);
  }, 250);

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList')) applyProfileActions();
  });
  observer.observe(document.body, { subtree:true, childList:true });
})();

(function loadBranchSubmissionFilters() {
  if (document.querySelector('script[data-ksc-branch-report-filters]')) return;
  const script = document.createElement('script');
  script.src = './branch-report-filters.js?v=20260805-0938';
  script.dataset.kscBranchReportFilters = 'true';
  script.async = false;
  document.body.appendChild(script);
})();