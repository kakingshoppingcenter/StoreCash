'use strict';

(function improvePasswordChangePlacement() {
  function installStyles() {
    if (document.getElementById('passwordChangeResponsiveStyles')) return;

    const style = document.createElement('style');
    style.id = 'passwordChangeResponsiveStyles';
    style.textContent = `
      .profile.password-change-enabled{grid-template-columns:40px minmax(0,1fr) 34px 34px}
      .password-change-mobile{display:none;align-items:center;gap:7px}
      .password-change-mobile svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      @media(max-width:1120px){.password-change-mobile{display:inline-flex}}
      @media(max-width:620px){.password-change-mobile{width:100%;justify-content:center}.top-actions .password-change-mobile{order:4}}
    `;
    document.head.appendChild(style);
  }

  function connectDesktopLayout() {
    const desktopButton = document.getElementById('changePasswordBtn');
    const profileArea = desktopButton?.closest('.profile');
    if (profileArea) profileArea.classList.add('password-change-enabled');
  }

  function createMobileButton() {
    if (document.getElementById('changePasswordMobileBtn')) return;

    const desktopButton = document.getElementById('changePasswordBtn');
    const topActions = document.querySelector('.top-actions');
    if (!desktopButton || !topActions) return;

    const button = document.createElement('button');
    button.id = 'changePasswordMobileBtn';
    button.className = 'btn secondary password-change-mobile';
    button.type = 'button';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="10" width="14" height="10" rx="2"></rect>
        <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
        <path d="M12 14v2"></path>
      </svg>
      <span>Change Password</span>`;
    button.addEventListener('click', () => desktopButton.click());
    topActions.insertBefore(button, document.getElementById('refreshBtn') || topActions.firstChild);
  }

  installStyles();
  connectDesktopLayout();
  createMobileButton();
})();
