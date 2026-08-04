'use strict';

(function installMobileUiV4() {
  if (window.__KSC_MOBILE_UI_V4__) return;
  window.__KSC_MOBILE_UI_V4__ = true;

  const STYLE_ID = 'kscMobileUiV4Styles';
  const PHONE_MAX = 760;
  let framePending = false;
  let observer = null;

  function viewportWidth() {
    return Math.round(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
  }

  function installStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        @media (max-width:760px){
          :root{
            --ksc-phone-bg:#eef3f8;
            --ksc-phone-surface:#ffffff;
            --ksc-phone-border:#dce5ef;
            --ksc-phone-muted:#6b7b90;
            --ksc-phone-ink:#14233a;
            --ksc-phone-blue:#176fe5;
            --ksc-phone-radius:16px;
            --ksc-phone-touch:48px;
            --ksc-phone-gutter:12px;
            --ksc-phone-bottom-nav:74px;
          }

          html body.ksc-phone-ui-v4 [hidden],
          html body.ksc-phone-ui-v4 .hidden,
          html body.ksc-phone-ui-v4 .view-hidden,
          html body.ksc-phone-ui-v4 #appShell.hidden,
          html body.ksc-phone-ui-v4 [data-permission].hidden,
          html body.ksc-phone-ui-v4 .nav-item.hidden{
            display:none!important;
          }

          html body.ksc-phone-ui-v4{
            min-width:320px!important;
            max-width:100%!important;
            overflow-x:hidden!important;
            background:var(--ksc-phone-bg)!important;
            color:var(--ksc-phone-ink)!important;
            -webkit-tap-highlight-color:transparent;
          }
          html body.ksc-phone-ui-v4 *{min-width:0}
          html body.ksc-phone-ui-v4 button,
          html body.ksc-phone-ui-v4 input,
          html body.ksc-phone-ui-v4 select,
          html body.ksc-phone-ui-v4 textarea{
            font-size:16px!important;
          }
          html body.ksc-phone-ui-v4 button:focus-visible,
          html body.ksc-phone-ui-v4 input:focus-visible,
          html body.ksc-phone-ui-v4 select:focus-visible,
          html body.ksc-phone-ui-v4 textarea:focus-visible,
          html body.ksc-phone-ui-v4 [tabindex="0"]:focus-visible{
            outline:3px solid rgba(23,111,229,.2)!important;
            outline-offset:2px!important;
          }

          /* Signed-out phone screen */
          html body.ksc-phone-ui-v4 #authScreen.auth-screen:not(.hidden):not([hidden]){
            display:flex!important;
            flex-direction:column!important;
            width:100%!important;
            min-height:100dvh!important;
            height:auto!important;
            overflow:visible!important;
            background:var(--ksc-phone-bg)!important;
          }
          html body.ksc-phone-ui-v4 #authScreen .auth-brand-panel{
            min-height:0!important;
            padding:calc(16px + env(safe-area-inset-top)) 16px 14px!important;
          }
          html body.ksc-phone-ui-v4 #authScreen .brand-logo.large{
            width:60px!important;
            height:60px!important;
            margin:0 auto 5px!important;
          }
          html body.ksc-phone-ui-v4 #authScreen .auth-brand-content h1{
            margin:5px 0 6px!important;
            font-size:28px!important;
            line-height:1.12!important;
          }
          html body.ksc-phone-ui-v4 #authScreen .auth-brand-content>p:not(.eyebrow){
            max-width:390px!important;
            font-size:11px!important;
            line-height:1.45!important;
          }
          html body.ksc-phone-ui-v4 #authScreen .auth-features{display:none!important}
          html body.ksc-phone-ui-v4 #authScreen .auth-form-panel{
            flex:1 0 auto!important;
            display:flex!important;
            align-items:flex-start!important;
            padding:12px var(--ksc-phone-gutter) calc(20px + env(safe-area-inset-bottom))!important;
          }
          html body.ksc-phone-ui-v4 #loginForm.login-card{
            width:100%!important;
            max-width:480px!important;
            gap:14px!important;
            padding:20px 16px!important;
            border-radius:20px!important;
            box-shadow:0 18px 48px rgba(20,43,74,.12)!important;
          }
          html body.ksc-phone-ui-v4 #loginForm .login-heading h2{font-size:23px!important}
          html body.ksc-phone-ui-v4 #loginForm input,
          html body.ksc-phone-ui-v4 #loginForm .btn{
            min-height:50px!important;
            border-radius:12px!important;
          }

          /* Native app frame */
          html body.ksc-phone-ui-v4 #appShell.app-shell:not(.hidden):not([hidden]){
            display:block!important;
            width:100%!important;
            min-height:100dvh!important;
          }
          html body.ksc-phone-ui-v4 .sidebar{
            position:sticky!important;
            inset:0 0 auto 0!important;
            z-index:850!important;
            width:100%!important;
            height:60px!important;
            min-height:60px!important;
            display:flex!important;
            align-items:center!important;
            justify-content:space-between!important;
            gap:8px!important;
            padding:7px max(11px,env(safe-area-inset-right)) 7px max(11px,env(safe-area-inset-left))!important;
            overflow:visible!important;
            background:linear-gradient(135deg,#071a31,#0b2b4f)!important;
            box-shadow:0 5px 18px rgba(7,24,45,.18)!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .brand{
            flex:1 1 auto!important;
            width:auto!important;
            min-width:0!important;
            min-height:44px!important;
            margin:0!important;
            gap:8px!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .brand-logo{
            width:36px!important;
            height:36px!important;
            flex:0 0 36px!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .brand h1{
            font-size:13px!important;
            line-height:1.2!important;
            white-space:nowrap!important;
            overflow:hidden!important;
            text-overflow:ellipsis!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .brand p{
            margin-top:2px!important;
            font-size:7.5px!important;
            line-height:1.2!important;
            white-space:nowrap!important;
            overflow:hidden!important;
            text-overflow:ellipsis!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .profile.password-change-enabled{
            flex:0 0 auto!important;
            display:flex!important;
            margin:0!important;
            padding:0!important;
            border:0!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .profile .avatar,
          html body.ksc-phone-ui-v4 .sidebar .profile .profile-copy{display:none!important}
          html body.ksc-phone-ui-v4 .sidebar .profile-actions{
            display:flex!important;
            width:auto!important;
            gap:6px!important;
            margin:0!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .profile-action-button,
          html body.ksc-phone-ui-v4 .sidebar .icon-btn{
            width:40px!important;
            min-width:40px!important;
            height:40px!important;
            min-height:40px!important;
            padding:0!important;
            border-radius:12px!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .profile-action-label{display:none!important}

          html body.ksc-phone-ui-v4 .sidebar nav{
            position:fixed!important;
            left:0!important;
            right:0!important;
            bottom:0!important;
            z-index:900!important;
            display:flex!important;
            align-items:stretch!important;
            justify-content:flex-start!important;
            width:100%!important;
            height:auto!important;
            gap:5px!important;
            padding:6px max(8px,env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important;
            overflow-x:auto!important;
            overflow-y:hidden!important;
            scroll-snap-type:x proximity!important;
            scrollbar-width:none!important;
            background:rgba(7,23,43,.98)!important;
            box-shadow:0 -8px 24px rgba(7,23,43,.2)!important;
            -webkit-backdrop-filter:blur(14px)!important;
            backdrop-filter:blur(14px)!important;
          }
          html body.ksc-phone-ui-v4 .sidebar nav::-webkit-scrollbar{display:none!important}
          html body.ksc-phone-ui-v4 .sidebar .nav-group-label{display:none!important}
          html body.ksc-phone-ui-v4 .sidebar .nav-item:not(.hidden):not([hidden]){
            flex:0 0 clamp(82px,24vw,100px)!important;
            min-height:54px!important;
            display:grid!important;
            grid-template-columns:1fr!important;
            justify-items:center!important;
            align-content:center!important;
            gap:3px!important;
            padding:5px!important;
            border-radius:12px!important;
            color:#cbd7e6!important;
            font-size:9px!important;
            font-weight:700!important;
            line-height:1.15!important;
            text-align:center!important;
            white-space:normal!important;
            scroll-snap-align:center!important;
            box-shadow:none!important;
            transform:none!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .nav-item.active{
            background:linear-gradient(135deg,#1d7df4,#0e61d2)!important;
            color:#fff!important;
            box-shadow:0 5px 14px rgba(20,104,218,.28)!important;
          }
          html body.ksc-phone-ui-v4 .sidebar .nav-icon,
          html body.ksc-phone-ui-v4 .sidebar .nav-icon svg{
            width:18px!important;
            height:18px!important;
          }
          html body.ksc-phone-ui-v4.ksc-keyboard-open .sidebar nav{display:none!important}

          html body.ksc-phone-ui-v4 main{
            width:100%!important;
            max-width:760px!important;
            margin:0 auto!important;
            padding:12px var(--ksc-phone-gutter) calc(var(--ksc-phone-bottom-nav) + 18px + env(safe-area-inset-bottom))!important;
          }
          html body.ksc-phone-ui-v4.ksc-keyboard-open main{padding-bottom:18px!important}

          /* Page heading and actions */
          html body.ksc-phone-ui-v4 .topbar{
            display:grid!important;
            grid-template-columns:1fr!important;
            gap:10px!important;
            margin-bottom:11px!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .topbar>div:first-child,
          html body.ksc-phone-ui-v4 .topbar .eyebrow,
          html body.ksc-phone-ui-v4 .topbar h2,
          html body.ksc-phone-ui-v4 .ksc-page-subtitle{
            width:100%!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .topbar h2{
            margin-top:4px!important;
            font-size:23px!important;
            line-height:1.16!important;
          }
          html body.ksc-phone-ui-v4 .ksc-page-subtitle{
            margin:4px 0 0!important;
            font-size:10px!important;
            line-height:1.45!important;
          }
          html body.ksc-phone-ui-v4 .top-actions{
            display:grid!important;
            grid-template-columns:repeat(2,minmax(0,1fr))!important;
            width:100%!important;
            gap:8px!important;
          }
          html body.ksc-phone-ui-v4 .top-actions>span,
          html body.ksc-phone-ui-v4 .top-actions .live-sync-status{
            grid-column:1/-1!important;
            width:100%!important;
            min-height:36px!important;
            display:flex!important;
            align-items:center!important;
            justify-content:center!important;
            margin:0!important;
            text-align:center!important;
            white-space:normal!important;
          }
          html body.ksc-phone-ui-v4 .top-actions .btn{
            width:100%!important;
            min-height:44px!important;
            padding:9px 10px!important;
            border-radius:12px!important;
          }

          /* Reporting controls */
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="day"],
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="week"],
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="range"]{
            display:grid!important;
            grid-template-columns:repeat(2,minmax(0,1fr))!important;
            gap:10px!important;
            min-height:0!important;
            padding:12px!important;
            margin-bottom:11px!important;
            border-radius:var(--ksc-phone-radius)!important;
            background:var(--ksc-phone-surface)!important;
          }
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-heading,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-mode-field,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="day"] .reporting-anchor-field,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="week"] .reporting-anchor-field,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-actions,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-summary{
            grid-column:1/-1!important;
          }
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-from-field{grid-column:1!important}
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-to-field{grid-column:2!important}
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-heading{
            display:grid!important;
            gap:3px!important;
            padding:0!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-heading strong{font-size:10px!important}
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-heading small{font-size:9px!important}
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar label{
            gap:6px!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar input,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar select{
            height:48px!important;
            min-height:48px!important;
            padding:10px 11px!important;
            text-align:left!important;
            border-radius:12px!important;
          }
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-actions{
            display:grid!important;
            grid-template-columns:repeat(2,minmax(0,1fr))!important;
            width:100%!important;
            min-height:0!important;
            gap:8px!important;
          }
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-actions .btn{
            width:100%!important;
            min-width:0!important;
            height:46px!important;
            min-height:46px!important;
            padding:8px 10px!important;
          }
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-summary{
            display:grid!important;
            gap:6px!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-summary-value{
            min-height:48px!important;
            padding:8px 11px!important;
            border-radius:12px!important;
          }
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-summary-value strong,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar .reporting-range-summary-value span{
            overflow:visible!important;
            text-overflow:clip!important;
            white-space:normal!important;
          }

          /* Shared cards */
          html body.ksc-phone-ui-v4 .notice,
          html body.ksc-phone-ui-v4 .card,
          html body.ksc-phone-ui-v4 .analytics-card,
          html body.ksc-phone-ui-v4 .admin-intro,
          html body.ksc-phone-ui-v4 .metrics article,
          html body.ksc-phone-ui-v4 .analytics-stat{
            width:100%!important;
            max-width:100%!important;
            border-radius:var(--ksc-phone-radius)!important;
            border-color:var(--ksc-phone-border)!important;
            box-shadow:0 5px 18px rgba(18,40,72,.055)!important;
          }
          html body.ksc-phone-ui-v4 .workspace,
          html body.ksc-phone-ui-v4 .lower-grid,
          html body.ksc-phone-ui-v4 .admin-grid,
          html body.ksc-phone-ui-v4 .analytics-grid{
            display:grid!important;
            grid-template-columns:minmax(0,1fr)!important;
            gap:10px!important;
          }
          html body.ksc-phone-ui-v4 .lower-grid,
          html body.ksc-phone-ui-v4 .audit-card{margin-top:10px!important}
          html body.ksc-phone-ui-v4 .card,
          html body.ksc-phone-ui-v4 .analytics-card,
          html body.ksc-phone-ui-v4 .admin-intro{padding:13px!important}
          html body.ksc-phone-ui-v4 .card-head,
          html body.ksc-phone-ui-v4 .analytics-card-head{
            display:grid!important;
            grid-template-columns:minmax(0,1fr) auto!important;
            align-items:start!important;
            gap:8px!important;
            margin-bottom:11px!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .card-head>div,
          html body.ksc-phone-ui-v4 .analytics-card-head>div{width:100%!important}
          html body.ksc-phone-ui-v4 .card-head h3,
          html body.ksc-phone-ui-v4 .card-head p,
          html body.ksc-phone-ui-v4 .analytics-card-head h4,
          html body.ksc-phone-ui-v4 .analytics-card-head p{
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .card-head h3{font-size:16px!important}
          html body.ksc-phone-ui-v4 .card-head .badge,
          html body.ksc-phone-ui-v4 .analytics-tag{
            justify-self:end!important;
            max-width:120px!important;
            white-space:normal!important;
            text-align:center!important;
          }

          /* Dashboard metric cards */
          html body.ksc-phone-ui-v4 .metrics,
          html body.ksc-phone-ui-v4 .analytics-stats{
            display:grid!important;
            grid-template-columns:repeat(2,minmax(0,1fr))!important;
            gap:9px!important;
            margin-bottom:11px!important;
          }
          html body.ksc-phone-ui-v4 .metrics article,
          html body.ksc-phone-ui-v4 .analytics-stat{
            min-height:102px!important;
            padding:13px 11px!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .metrics span,
          html body.ksc-phone-ui-v4 .metrics strong,
          html body.ksc-phone-ui-v4 .metrics small,
          html body.ksc-phone-ui-v4 .analytics-stat-label,
          html body.ksc-phone-ui-v4 .analytics-stat-value,
          html body.ksc-phone-ui-v4 .analytics-stat-note{
            width:100%!important;
            text-align:left!important;
            overflow-wrap:anywhere!important;
          }
          html body.ksc-phone-ui-v4 .metrics strong,
          html body.ksc-phone-ui-v4 .analytics-stat-value{
            margin:7px 0 5px!important;
            font-size:clamp(18px,5.3vw,23px)!important;
          }
          html body.ksc-phone-ui-v4 .analytics-heading{
            align-items:flex-start!important;
            margin:2px 0 0!important;
          }
          html body.ksc-phone-ui-v4 .analytics-heading h3,
          html body.ksc-phone-ui-v4 .analytics-heading p{text-align:left!important}
          html body.ksc-phone-ui-v4 .analytics-period{display:none!important}

          /* Reconciliation */
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-toolbar{
            display:grid!important;
            grid-template-columns:1fr!important;
            gap:6px!important;
            padding:7px 8px!important;
          }
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-toolbar small{
            max-width:none!important;
            text-align:left!important;
            white-space:normal!important;
          }
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-table-head{display:none!important}
          html body.ksc-phone-ui-v4 .compact-reconciliation-card #branchBars{
            max-height:310px!important;
            overflow-y:auto!important;
            overflow-x:hidden!important;
            border-radius:12px!important;
            scrollbar-gutter:stable!important;
          }
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-row{
            display:grid!important;
            grid-template-columns:minmax(0,1fr) minmax(105px,.72fr)!important;
            gap:8px 10px!important;
            min-height:0!important;
            padding:10px!important;
          }
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-branch{grid-column:1!important;grid-row:1!important}
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-result{grid-column:2!important;grid-row:1!important;text-align:right!important}
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .reported-amount{grid-column:1!important;grid-row:2!important}
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .received-amount{grid-column:2!important;grid-row:2!important}
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-branch strong,
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-amount>strong{font-size:10px!important}
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-auto-note{font-size:7.5px!important}

          /* Payment mix */
          html body.ksc-phone-ui-v4 .payment-card .donut-layout{
            display:grid!important;
            grid-template-columns:1fr!important;
            gap:10px!important;
            min-height:0!important;
          }
          html body.ksc-phone-ui-v4 .payment-card .native-donut{
            width:168px!important;
            height:168px!important;
            margin:0 auto!important;
          }
          html body.ksc-phone-ui-v4 .payment-card .donut-legend{
            width:100%!important;
            gap:0!important;
          }
          html body.ksc-phone-ui-v4 .payment-card .donut-legend-row{
            grid-template-columns:10px minmax(66px,1fr) minmax(82px,auto) 42px!important;
            gap:7px!important;
            min-height:32px!important;
            padding:6px 0!important;
          }
          html body.ksc-phone-ui-v4 .payment-card .legend-label,
          html body.ksc-phone-ui-v4 .payment-card .donut-legend-row strong,
          html body.ksc-phone-ui-v4 .payment-card .donut-legend-row small{font-size:9px!important}

          /* Forms */
          html body.ksc-phone-ui-v4 label{
            width:100%!important;
            gap:6px!important;
            text-align:left!important;
            line-height:1.35!important;
          }
          html body.ksc-phone-ui-v4 input,
          html body.ksc-phone-ui-v4 select,
          html body.ksc-phone-ui-v4 textarea{
            width:100%!important;
            max-width:100%!important;
            min-height:var(--ksc-phone-touch)!important;
            padding:11px 12px!important;
            border-radius:12px!important;
          }
          html body.ksc-phone-ui-v4 textarea{min-height:96px!important;line-height:1.45!important}
          html body.ksc-phone-ui-v4 .form-grid.two,
          html body.ksc-phone-ui-v4 .admin-form-row{
            grid-template-columns:minmax(0,1fr)!important;
            gap:10px!important;
          }
          html body.ksc-phone-ui-v4 .payment-grid,
          html body.ksc-phone-ui-v4 .checker-scope-grid{
            grid-template-columns:repeat(2,minmax(0,1fr))!important;
            gap:9px!important;
          }
          html body.ksc-phone-ui-v4 .money-input input{text-align:right!important}
          html body.ksc-phone-ui-v4 .total-box{
            display:grid!important;
            grid-template-columns:1fr!important;
            justify-items:center!important;
            gap:4px!important;
            padding:13px!important;
            text-align:center!important;
          }
          html body.ksc-phone-ui-v4 .actions,
          html body.ksc-phone-ui-v4 .admin-actions{
            display:grid!important;
            grid-template-columns:minmax(0,1fr)!important;
            gap:8px!important;
            width:100%!important;
          }
          html body.ksc-phone-ui-v4 .actions .btn,
          html body.ksc-phone-ui-v4 .admin-actions .btn,
          html body.ksc-phone-ui-v4 .btn.full{
            width:100%!important;
            min-height:48px!important;
            border-radius:12px!important;
            white-space:normal!important;
          }
          html body.ksc-phone-ui-v4 #submitReportBtn{order:-1!important}

          /* Deposit checker */
          html body.ksc-phone-ui-v4 .comparison{
            display:grid!important;
            grid-template-columns:1fr!important;
            gap:9px!important;
          }
          html body.ksc-phone-ui-v4 .comparison>div:not(.checker-authorized-panel){
            display:grid!important;
            grid-template-columns:minmax(0,1fr) auto!important;
            align-items:center!important;
            justify-items:stretch!important;
            gap:10px!important;
            padding:10px 2px!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .comparison>div span{text-align:left!important}
          html body.ksc-phone-ui-v4 .comparison>div strong{text-align:right!important;overflow-wrap:anywhere!important}
          html body.ksc-phone-ui-v4 .checker-authorized-panel,
          html body.ksc-phone-ui-v4 .checker-scope-editor{padding:11px!important}
          html body.ksc-phone-ui-v4 .checker-authorized-head{
            display:grid!important;
            justify-items:start!important;
            gap:4px!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .checker-scope-values{grid-template-columns:1fr!important;gap:7px!important}

          /* Mobile record tables */
          html body.ksc-phone-ui-v4 .table-controls{width:100%!important}
          html body.ksc-phone-ui-v4 .table-controls input{text-align:left!important}
          html body.ksc-phone-ui-v4 .table-wrap,
          html body.ksc-phone-ui-v4 .admin-table-wrap{
            width:100%!important;
            max-width:100%!important;
            border:0!important;
            background:transparent!important;
          }
          html body.ksc-phone-ui-v4 .table-card.period-scroll-enabled .table-wrap{
            max-height:430px!important;
            overflow-y:auto!important;
            overflow-x:hidden!important;
            padding-right:2px!important;
            overscroll-behavior:contain!important;
          }
          html body.ksc-phone-ui-v4 table{
            display:block!important;
            width:100%!important;
            table-layout:fixed!important;
          }
          html body.ksc-phone-ui-v4 table thead{display:none!important}
          html body.ksc-phone-ui-v4 table tbody{
            display:grid!important;
            width:100%!important;
            gap:8px!important;
          }
          html body.ksc-phone-ui-v4 table tbody tr{
            display:block!important;
            width:100%!important;
            padding:6px 10px!important;
            border:1px solid var(--ksc-phone-border)!important;
            border-radius:14px!important;
            background:#fff!important;
            box-shadow:0 3px 12px rgba(18,40,72,.045)!important;
          }
          html body.ksc-phone-ui-v4 table tbody td{
            display:grid!important;
            grid-template-columns:minmax(92px,.78fr) minmax(0,1.22fr)!important;
            align-items:start!important;
            gap:9px!important;
            width:100%!important;
            min-height:32px!important;
            padding:7px 1px!important;
            border-bottom:1px solid #edf1f5!important;
            white-space:normal!important;
            text-align:right!important;
            overflow-wrap:anywhere!important;
          }
          html body.ksc-phone-ui-v4 table tbody td:last-child{border-bottom:0!important}
          html body.ksc-phone-ui-v4 table tbody td::before{
            content:attr(data-label);
            color:var(--ksc-phone-muted)!important;
            font-size:8.5px!important;
            font-weight:800!important;
            text-align:left!important;
            text-transform:uppercase!important;
            letter-spacing:.04em!important;
          }
          html body.ksc-phone-ui-v4 table tbody td>*{
            max-width:100%!important;
            justify-self:end!important;
            white-space:normal!important;
            overflow-wrap:anywhere!important;
          }
          html body.ksc-phone-ui-v4 table tbody td[colspan]{display:block!important;text-align:center!important;padding:22px 8px!important;border:0!important}
          html body.ksc-phone-ui-v4 table tbody td[colspan]::before{display:none!important}

          /* Executive summary */
          html body.ksc-phone-ui-v4 .summary-content{gap:0!important;margin-top:10px!important}
          html body.ksc-phone-ui-v4 .summary-title{
            padding:10px!important;
            border:1px solid #d7e5f5!important;
            border-radius:12px!important;
            background:#f2f7fd!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .summary-row{
            display:grid!important;
            grid-template-columns:minmax(0,1fr) auto!important;
            align-items:center!important;
            gap:10px!important;
            padding:8px 2px!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .summary-row span{text-align:left!important}
          html body.ksc-phone-ui-v4 .summary-row strong{text-align:right!important;overflow-wrap:anywhere!important}
          html body.ksc-phone-ui-v4 .summary-row.total{margin:5px 0 0!important;padding:10px!important}

          /* Administration */
          html body.ksc-phone-ui-v4 .admin-shell{gap:10px!important}
          html body.ksc-phone-ui-v4 .admin-intro{
            display:grid!important;
            justify-items:start!important;
            gap:8px!important;
            text-align:left!important;
          }
          html body.ksc-phone-ui-v4 .admin-intro h3,
          html body.ksc-phone-ui-v4 .admin-intro p{text-align:left!important}
          html body.ksc-phone-ui-v4 .admin-panel{overflow:hidden!important}
          html body.ksc-phone-ui-v4 .permission-grid{grid-template-columns:1fr!important;gap:8px!important}
          html body.ksc-phone-ui-v4 .permission-group{padding:10px!important;border-radius:12px!important}
          html body.ksc-phone-ui-v4 .permission-toggle,
          html body.ksc-phone-ui-v4 .switch-line,
          html body.ksc-phone-ui-v4 .checker-scope-option{
            min-height:46px!important;
            align-items:center!important;
            padding:8px!important;
            border-radius:11px!important;
          }
          html body.ksc-phone-ui-v4 .permission-toggle input,
          html body.ksc-phone-ui-v4 .switch-line input,
          html body.ksc-phone-ui-v4 .checker-scope-option input{
            width:20px!important;
            height:20px!important;
            min-height:0!important;
            flex:0 0 20px!important;
          }
          html body.ksc-phone-ui-v4 .admin-section-title{
            display:grid!important;
            justify-items:start!important;
            gap:3px!important;
            text-align:left!important;
          }

          /* Dialogs as phone bottom sheets */
          html body.ksc-phone-ui-v4 .password-modal-backdrop,
          html body.ksc-phone-ui-v4 .admin-delete-modal,
          html body.ksc-phone-ui-v4 .system-reset-modal,
          html body.ksc-phone-ui-v4 .branch-delete-backdrop{
            align-items:end!important;
            padding:0!important;
          }
          html body.ksc-phone-ui-v4 .password-modal,
          html body.ksc-phone-ui-v4 .admin-delete-dialog,
          html body.ksc-phone-ui-v4 .system-reset-dialog,
          html body.ksc-phone-ui-v4 .branch-delete-dialog{
            width:100%!important;
            max-width:none!important;
            max-height:92dvh!important;
            overflow:auto!important;
            border-radius:22px 22px 0 0!important;
          }
          html body.ksc-phone-ui-v4 .password-modal-actions,
          html body.ksc-phone-ui-v4 .admin-delete-actions{
            display:grid!important;
            grid-template-columns:1fr!important;
            gap:8px!important;
          }
          html body.ksc-phone-ui-v4 .password-modal-actions button,
          html body.ksc-phone-ui-v4 .admin-delete-actions button{width:100%!important;min-height:48px!important}

          html body.ksc-phone-ui-v4 .toast{
            left:50%!important;
            right:auto!important;
            bottom:calc(var(--ksc-phone-bottom-nav) + 8px + env(safe-area-inset-bottom))!important;
            width:calc(100vw - 22px)!important;
            max-width:520px!important;
            text-align:center!important;
            transform:translate(-50%,10px)!important;
          }
          html body.ksc-phone-ui-v4 .toast.show{transform:translate(-50%,0)!important}
          html body.ksc-phone-ui-v4.ksc-keyboard-open .toast{bottom:10px!important}
          html body.ksc-phone-ui-v4 .system-copyright{
            padding:16px 4px 2px!important;
            text-align:center!important;
            font-size:9px!important;
          }
        }

        @media (max-width:390px){
          html body.ksc-phone-ui-v4 .metrics,
          html body.ksc-phone-ui-v4 .analytics-stats{grid-template-columns:1fr!important}
          html body.ksc-phone-ui-v4 .metrics article,
          html body.ksc-phone-ui-v4 .analytics-stat{min-height:92px!important}
          html body.ksc-phone-ui-v4 .top-actions{grid-template-columns:1fr!important}
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="day"],
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="week"],
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="range"]{grid-template-columns:1fr!important}
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-from-field,
          html body.ksc-phone-ui-v4 .toolbar.reporting-range-toolbar[data-report-mode="range"] .reporting-to-field{grid-column:1!important}
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-row{grid-template-columns:1fr!important}
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-branch,
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-result,
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .reported-amount,
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .received-amount{grid-column:1!important;grid-row:auto!important}
          html body.ksc-phone-ui-v4 .compact-reconciliation-card .recon-result{text-align:left!important}
          html body.ksc-phone-ui-v4 table tbody td,
          html body.ksc-phone-ui-v4 .summary-row,
          html body.ksc-phone-ui-v4 .comparison>div:not(.checker-authorized-panel){grid-template-columns:1fr!important;gap:3px!important;text-align:left!important}
          html body.ksc-phone-ui-v4 table tbody td,
          html body.ksc-phone-ui-v4 table tbody td::before,
          html body.ksc-phone-ui-v4 table tbody td>*,
          html body.ksc-phone-ui-v4 .summary-row span,
          html body.ksc-phone-ui-v4 .summary-row strong,
          html body.ksc-phone-ui-v4 .comparison>div span,
          html body.ksc-phone-ui-v4 .comparison>div strong{text-align:left!important;justify-self:start!important}
        }

        @media (max-width:350px){
          html body.ksc-phone-ui-v4 .payment-grid,
          html body.ksc-phone-ui-v4 .checker-scope-grid{grid-template-columns:1fr!important}
          html body.ksc-phone-ui-v4 .sidebar .brand p{display:none!important}
          html body.ksc-phone-ui-v4 .sidebar .nav-item:not(.hidden):not([hidden]){flex-basis:80px!important}
        }

        @media (max-width:760px) and (orientation:landscape) and (max-height:520px){
          html body.ksc-phone-ui-v4 .sidebar{height:54px!important;min-height:54px!important}
          html body.ksc-phone-ui-v4 main{padding-top:9px!important}
          html body.ksc-phone-ui-v4 #authScreen .auth-brand-panel{padding-top:10px!important;padding-bottom:10px!important}
        }
      `;
      document.body.appendChild(style);
    } else if (style.parentElement !== document.body) {
      document.body.appendChild(style);
    }
    return style;
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function enhanceTables() {
    document.querySelectorAll('table').forEach((table) => {
      const headers = [...table.querySelectorAll('thead th')].map((cell) => clean(cell.textContent));
      table.querySelectorAll('tbody tr').forEach((row) => {
        const cells = [...row.children].filter((cell) => cell.tagName === 'TD');
        if (cells.length === 1 && cells[0].hasAttribute('colspan')) return;
        cells.forEach((cell, index) => {
          if (headers[index] && cell.dataset.label !== headers[index]) cell.dataset.label = headers[index];
        });
      });
    });
  }

  function enhanceNavigation() {
    const nav = document.querySelector('.sidebar nav');
    if (nav) {
      nav.setAttribute('aria-label', 'Mobile application navigation');
      nav.setAttribute('role', 'navigation');
    }

    document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
      const label = clean(button.textContent);
      if (label) button.setAttribute('aria-label', label);
    });
  }

  function enhanceScrollableRegions() {
    document.querySelectorAll('.table-card.period-scroll-enabled .table-wrap, .compact-reconciliation-card #branchBars').forEach((region) => {
      if (region.scrollHeight <= region.clientHeight + 2) return;
      region.tabIndex = 0;
      if (!region.getAttribute('role')) region.setAttribute('role', 'region');
      if (!region.getAttribute('aria-label')) region.setAttribute('aria-label', 'Scrollable report results');
    });
  }

  function centerActiveNavigation(behavior = 'smooth') {
    if (viewportWidth() > PHONE_MAX) return;
    const active = document.querySelector('.sidebar .nav-item.active:not(.hidden):not([hidden])');
    if (!active) return;
    try {
      active.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
    } catch (_) {
      active.scrollIntoView();
    }
  }

  function apply() {
    framePending = false;
    const phone = viewportWidth() <= PHONE_MAX;
    document.body.classList.toggle('ksc-phone-ui-v4', phone);
    document.body.dataset.phoneUi = phone ? 'native' : 'desktop';
    installStyles();
    enhanceTables();
    enhanceNavigation();
    enhanceScrollableRegions();
  }

  function queueApply() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(apply);
  }

  function initialize() {
    installStyles();
    apply();

    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === 'childList')) queueApply();
    });
    observer.observe(document.body, { subtree: true, childList: true });

    window.setTimeout(() => { installStyles(); queueApply(); }, 250);
    window.setTimeout(() => { installStyles(); queueApply(); }, 1200);
    window.setTimeout(() => { installStyles(); queueApply(); }, 2600);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('.nav-item[data-view]')) window.setTimeout(() => centerActiveNavigation('smooth'), 30);
  }, true);
  document.addEventListener('ksc:reporting-period-loaded', queueApply);
  document.addEventListener('ksc:permissions-refreshed', queueApply);
  window.addEventListener('resize', queueApply, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(queueApply, 120), { passive: true });
  window.visualViewport?.addEventListener('resize', queueApply, { passive: true });
  window.addEventListener('pageshow', () => { installStyles(); queueApply(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();