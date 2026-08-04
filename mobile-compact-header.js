'use strict';

(function installMobileCompactHeader() {
  if (window.__KSC_MOBILE_COMPACT_HEADER_V1__) return;
  window.__KSC_MOBILE_COMPACT_HEADER_V1__ = true;

  const STYLE_ID = 'kscMobileCompactHeaderStyles';
  let framePending = false;

  function viewportWidth() {
    return Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
  }

  function installStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.body.appendChild(style);
    } else if (style.parentElement !== document.body) {
      document.body.appendChild(style);
    }

    style.textContent = `
      @media(max-width:760px){
        html body.ksc-phone-compact-header .topbar{
          gap:6px!important;
          margin-bottom:8px!important;
        }
        html body.ksc-phone-compact-header .topbar .eyebrow{
          font-size:8px!important;
          line-height:1.15!important;
        }
        html body.ksc-phone-compact-header .topbar h2{
          margin-top:2px!important;
          font-size:20px!important;
          line-height:1.12!important;
        }
        html body.ksc-phone-compact-header .ksc-page-subtitle{
          display:none!important;
        }

        html body.ksc-phone-compact-header .top-actions{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:6px!important;
          align-items:stretch!important;
        }
        html body.ksc-phone-compact-header .top-actions #todayLabel{
          grid-column:1!important;
        }
        html body.ksc-phone-compact-header .top-actions .live-sync-status{
          grid-column:2!important;
        }
        html body.ksc-phone-compact-header .top-actions #todayLabel,
        html body.ksc-phone-compact-header .top-actions .live-sync-status{
          width:100%!important;
          min-height:30px!important;
          height:30px!important;
          margin:0!important;
          padding:5px 7px!important;
          border-radius:9px!important;
          justify-content:center!important;
          overflow:hidden!important;
          font-size:8.5px!important;
          line-height:1!important;
          white-space:nowrap!important;
          text-overflow:ellipsis!important;
        }
        html body.ksc-phone-compact-header .top-actions .live-sync-dot{
          width:6px!important;
          height:6px!important;
          flex:0 0 6px!important;
          box-shadow:0 0 0 3px rgba(29,155,80,.12)!important;
        }
        html body.ksc-phone-compact-header .top-actions .btn{
          min-height:40px!important;
          height:40px!important;
          padding:7px 9px!important;
          border-radius:10px!important;
          font-size:10px!important;
        }
        html body.ksc-phone-compact-header .top-actions .password-change-mobile,
        html body.ksc-phone-compact-header #changePasswordMobileBtn{
          display:none!important;
        }

        html body.ksc-phone-compact-header .sidebar .profile.password-change-enabled{
          display:flex!important;
          flex:0 0 auto!important;
          margin:0!important;
          padding:0!important;
          border:0!important;
        }
        html body.ksc-phone-compact-header .sidebar .profile-actions{
          display:flex!important;
          width:auto!important;
          gap:5px!important;
          margin:0!important;
        }
        html body.ksc-phone-compact-header .sidebar #changePasswordBtn.profile-action-button,
        html body.ksc-phone-compact-header .sidebar #logoutBtn.profile-action-button{
          display:inline-flex!important;
          width:38px!important;
          min-width:38px!important;
          height:38px!important;
          min-height:38px!important;
          padding:0!important;
          flex:0 0 38px!important;
          border-radius:11px!important;
        }
        html body.ksc-phone-compact-header .sidebar .profile-action-label{
          display:none!important;
        }

        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar,
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar[data-report-mode="day"],
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar[data-report-mode="week"],
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar[data-report-mode="range"]{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:7px!important;
          min-height:0!important;
          padding:9px!important;
          margin-bottom:9px!important;
          border-radius:14px!important;
          align-items:end!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-heading{
          display:none!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-mode-field{
          grid-column:1!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar[data-report-mode="day"] .reporting-anchor-field,
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar[data-report-mode="week"] .reporting-anchor-field{
          grid-column:2!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-mode-field{
          grid-column:1/-1!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-from-field{
          grid-column:1!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-to-field{
          grid-column:2!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar label{
          gap:4px!important;
          font-size:8.5px!important;
          line-height:1.15!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar input,
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar select{
          height:42px!important;
          min-height:42px!important;
          padding:8px 9px!important;
          border-radius:10px!important;
          font-size:14px!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-actions{
          grid-column:1!important;
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          width:100%!important;
          min-height:0!important;
          gap:6px!important;
          align-self:end!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-actions .btn{
          width:100%!important;
          min-width:0!important;
          height:40px!important;
          min-height:40px!important;
          padding:6px 7px!important;
          border-radius:10px!important;
          font-size:10px!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-summary{
          grid-column:2!important;
          display:block!important;
          align-self:end!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-summary-title{
          display:none!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-summary-value{
          min-height:40px!important;
          height:40px!important;
          padding:5px 8px!important;
          border-radius:10px!important;
          justify-content:center!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-summary-value strong{
          font-size:9.5px!important;
          line-height:1.1!important;
          white-space:nowrap!important;
          overflow:hidden!important;
          text-overflow:ellipsis!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-summary-value span{
          display:none!important;
        }
      }

      @media(max-width:370px){
        html body.ksc-phone-compact-header .top-actions #todayLabel{
          display:none!important;
        }
        html body.ksc-phone-compact-header .top-actions .live-sync-status{
          grid-column:1/-1!important;
        }
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-actions,
        html body.ksc-phone-compact-header .toolbar.reporting-range-toolbar .reporting-range-summary{
          grid-column:1/-1!important;
        }
      }
    `;
  }

  function connectAccountActions() {
    const duplicate = document.getElementById('changePasswordMobileBtn');
    if (duplicate) duplicate.remove();

    const password = document.getElementById('changePasswordBtn');
    const logout = document.getElementById('logoutBtn');
    const profile = logout?.closest('.profile');
    if (!password || !logout || !profile) return;

    profile.classList.add('password-change-enabled');
    let actions = profile.querySelector('.profile-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'profile-actions';
      actions.setAttribute('aria-label', 'Account actions');
      profile.appendChild(actions);
    }
    if (password.parentElement !== actions) actions.appendChild(password);
    if (logout.parentElement !== actions) actions.appendChild(logout);
  }

  function apply() {
    framePending = false;
    const phone = viewportWidth() <= 760;
    document.body.classList.toggle('ksc-phone-compact-header', phone);
    installStyles();
    connectAccountActions();
  }

  function queueApply() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(apply);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList')) queueApply();
  });

  function initialize() {
    installStyles();
    apply();
    observer.observe(document.body, { subtree: true, childList: true });
    window.setTimeout(queueApply, 250);
    window.setTimeout(queueApply, 1000);
    window.setTimeout(queueApply, 2400);
  }

  window.addEventListener('resize', queueApply, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(queueApply, 120), { passive: true });
  window.visualViewport?.addEventListener('resize', queueApply, { passive: true });
  window.addEventListener('pageshow', queueApply);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();