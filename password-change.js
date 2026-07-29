'use strict';

(function installPasswordChangeFeature() {
  const MIN_PASSWORD_LENGTH = 10;
  const MAX_PASSWORD_LENGTH = 72;

  function installStyles() {
    if (document.getElementById('passwordChangeStyles')) return;

    const style = document.createElement('style');
    style.id = 'passwordChangeStyles';
    style.textContent = `
      .password-change-trigger{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border:1px solid rgba(255,255,255,.22);border-radius:9px;background:rgba(255,255,255,.04);color:#fff;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease}
      .password-change-trigger:hover{background:rgba(255,255,255,.11);border-color:rgba(255,255,255,.42);transform:translateY(-1px)}
      .password-change-trigger:focus-visible{outline:3px solid rgba(59,130,246,.45);outline-offset:2px}
      .password-change-trigger svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      .password-modal-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(7,19,35,.62);backdrop-filter:blur(4px)}
      .password-modal-backdrop.hidden{display:none}
      .password-modal{width:min(100%,480px);max-height:min(760px,calc(100vh - 32px));overflow:auto;border:1px solid #dbe4ef;border-radius:18px;background:#fff;box-shadow:0 28px 75px rgba(10,31,58,.28)}
      .password-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 22px 14px}
      .password-modal-header h3{margin:0 0 6px;color:#0d2038;font-size:21px;line-height:1.2}
      .password-modal-header p{margin:0;color:#66758a;font-size:12px;line-height:1.55}
      .password-modal-close{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border:1px solid #dbe4ef;border-radius:9px;background:#fff;color:#43536a;font-size:20px;line-height:1;cursor:pointer}
      .password-modal-close:hover{background:#f4f7fb}
      .password-change-form{display:grid;gap:15px;padding:6px 22px 22px}
      .password-field-label{display:grid;gap:7px;color:#26364c;font-size:11px;font-weight:750}
      .password-field-wrap{position:relative}
      .password-field-wrap input{width:100%;height:44px;padding:0 45px 0 13px;border:1px solid #cfdbe9;border-radius:10px;background:#fff;color:#16283f;font:inherit;outline:none}
      .password-field-wrap input:focus{border-color:#2775dd;box-shadow:0 0 0 3px rgba(39,117,221,.13)}
      .password-visibility-toggle{position:absolute;top:50%;right:7px;transform:translateY(-50%);display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:7px;background:transparent;color:#68788d;cursor:pointer}
      .password-visibility-toggle:hover{background:#eef3f8;color:#25364d}
      .password-rules{display:grid;grid-template-columns:1fr 1fr;gap:7px 14px;margin:0;padding:12px 13px;border:1px solid #e1e8f1;border-radius:10px;background:#f8fafc;color:#6a788b;font-size:10px;line-height:1.4}
      .password-rule{display:flex;align-items:center;gap:7px}
      .password-rule:before{content:'•';font-size:16px;line-height:1;color:#9aa8b9}
      .password-rule.valid{color:#15753b}
      .password-rule.valid:before{content:'✓';font-size:11px;font-weight:900;color:#169447}
      .password-change-message{min-height:17px;margin:0;color:#b42318;font-size:11px;font-weight:650;line-height:1.45;text-align:center}
      .password-modal-actions{display:grid;grid-template-columns:1fr 1.3fr;gap:10px;padding-top:2px}
      .password-modal-actions .btn{width:100%}
      .password-security-note{margin:0;padding:11px 12px;border-radius:9px;background:#eef6ff;color:#315d8f;font-size:10px;line-height:1.5}
      body.password-modal-open{overflow:hidden}
      @media(max-width:620px){.password-modal-backdrop{align-items:end;padding:0}.password-modal{width:100%;max-height:92vh;border-radius:18px 18px 0 0}.password-modal-header{padding:20px 18px 12px}.password-change-form{padding:6px 18px 20px}.password-rules{grid-template-columns:1fr}.password-modal-actions{grid-template-columns:1fr}.password-change-trigger{width:36px;height:36px;flex-basis:36px}}
    `;

    document.head.appendChild(style);
  }

  function createTrigger() {
    let button = document.getElementById('changePasswordBtn');
    if (button) return button;

    const logoutButton = document.getElementById('logoutBtn');
    if (!logoutButton?.parentElement) return null;

    button = document.createElement('button');
    button.id = 'changePasswordBtn';
    button.className = 'password-change-trigger';
    button.type = 'button';
    button.title = 'Change password';
    button.setAttribute('aria-label', 'Change password');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="10" width="14" height="10" rx="2"></rect>
        <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
        <path d="M12 14v2"></path>
      </svg>`;

    logoutButton.parentElement.insertBefore(button, logoutButton);
    button.addEventListener('click', openModal);
    return button;
  }

  function createModal() {
    let backdrop = document.getElementById('passwordChangeBackdrop');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.id = 'passwordChangeBackdrop';
    backdrop.className = 'password-modal-backdrop hidden';
    backdrop.setAttribute('role', 'presentation');
    backdrop.innerHTML = `
      <section class="password-modal" role="dialog" aria-modal="true" aria-labelledby="passwordChangeTitle">
        <header class="password-modal-header">
          <div>
            <h3 id="passwordChangeTitle">Change Password</h3>
            <p>Confirm your current password, then create a strong new password for your account.</p>
          </div>
          <button id="passwordChangeCloseBtn" class="password-modal-close" type="button" aria-label="Close password dialog">×</button>
        </header>

        <form id="passwordChangeForm" class="password-change-form" novalidate>
          <label class="password-field-label">
            Current Password
            <span class="password-field-wrap">
              <input id="currentAccountPassword" type="password" autocomplete="current-password" required />
              <button class="password-visibility-toggle" type="button" data-password-target="currentAccountPassword" aria-label="Show current password">Show</button>
            </span>
          </label>

          <label class="password-field-label">
            New Password
            <span class="password-field-wrap">
              <input id="newAccountPassword" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" required />
              <button class="password-visibility-toggle" type="button" data-password-target="newAccountPassword" aria-label="Show new password">Show</button>
            </span>
          </label>

          <label class="password-field-label">
            Confirm New Password
            <span class="password-field-wrap">
              <input id="confirmAccountPassword" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" required />
              <button class="password-visibility-toggle" type="button" data-password-target="confirmAccountPassword" aria-label="Show password confirmation">Show</button>
            </span>
          </label>

          <div class="password-rules" aria-label="Password requirements">
            <span id="passwordRuleLength" class="password-rule">10–72 characters</span>
            <span id="passwordRuleUpper" class="password-rule">One uppercase letter</span>
            <span id="passwordRuleLower" class="password-rule">One lowercase letter</span>
            <span id="passwordRuleNumber" class="password-rule">One number</span>
            <span id="passwordRuleSymbol" class="password-rule">One symbol</span>
            <span id="passwordRuleSpaces" class="password-rule">No spaces</span>
          </div>

          <p class="password-security-note">After the change is completed, all active sessions will be signed out. Sign in again using the new password.</p>
          <p id="passwordChangeMessage" class="password-change-message" aria-live="polite"></p>

          <div class="password-modal-actions">
            <button id="passwordChangeCancelBtn" class="btn ghost" type="button">Cancel</button>
            <button id="passwordChangeSubmitBtn" class="btn primary" type="submit">Update Password</button>
          </div>
        </form>
      </section>`;

    document.body.appendChild(backdrop);

    document.getElementById('passwordChangeCloseBtn').addEventListener('click', closeModal);
    document.getElementById('passwordChangeCancelBtn').addEventListener('click', closeModal);
    document.getElementById('passwordChangeForm').addEventListener('submit', submitPasswordChange);
    document.getElementById('newAccountPassword').addEventListener('input', updatePasswordRules);
    document.getElementById('confirmAccountPassword').addEventListener('input', clearMessage);
    document.getElementById('currentAccountPassword').addEventListener('input', clearMessage);

    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) closeModal();
    });

    document.querySelectorAll('[data-password-target]').forEach((button) => {
      button.addEventListener('click', () => togglePasswordVisibility(button));
    });

    return backdrop;
  }

  function togglePasswordVisibility(button) {
    const input = document.getElementById(button.dataset.passwordTarget);
    if (!input) return;

    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.textContent = showing ? 'Show' : 'Hide';
    button.setAttribute('aria-label', `${showing ? 'Show' : 'Hide'} ${input.id === 'currentAccountPassword' ? 'current password' : 'new password'}`);
  }

  function openModal() {
    if (!db || !session?.user) {
      showToast('Sign in before changing your password.', 'error');
      return;
    }

    const backdrop = createModal();
    resetForm();
    backdrop.classList.remove('hidden');
    document.body.classList.add('password-modal-open');
    window.setTimeout(() => document.getElementById('currentAccountPassword')?.focus(), 30);
  }

  function closeModal() {
    const backdrop = document.getElementById('passwordChangeBackdrop');
    if (!backdrop || backdrop.classList.contains('hidden')) return;

    backdrop.classList.add('hidden');
    document.body.classList.remove('password-modal-open');
    resetForm();
    document.getElementById('changePasswordBtn')?.focus();
  }

  function resetForm() {
    const form = document.getElementById('passwordChangeForm');
    if (form) form.reset();

    document.querySelectorAll('[data-password-target]').forEach((button) => {
      const input = document.getElementById(button.dataset.passwordTarget);
      if (input) input.type = 'password';
      button.textContent = 'Show';
    });

    clearMessage();
    updatePasswordRules();
    setSubmitState(false);
  }

  function clearMessage() {
    const message = document.getElementById('passwordChangeMessage');
    if (message) message.textContent = '';
  }

  function passwordChecks(password) {
    return {
      length: password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9\s]/.test(password),
      spaces: !/\s/.test(password)
    };
  }

  function updatePasswordRules() {
    const password = document.getElementById('newAccountPassword')?.value || '';
    const checks = passwordChecks(password);
    const ids = {
      length: 'passwordRuleLength',
      upper: 'passwordRuleUpper',
      lower: 'passwordRuleLower',
      number: 'passwordRuleNumber',
      symbol: 'passwordRuleSymbol',
      spaces: 'passwordRuleSpaces'
    };

    Object.entries(ids).forEach(([key, id]) => {
      document.getElementById(id)?.classList.toggle('valid', Boolean(checks[key]));
    });

    return Object.values(checks).every(Boolean);
  }

  function setSubmitState(submitting) {
    const submit = document.getElementById('passwordChangeSubmitBtn');
    const cancel = document.getElementById('passwordChangeCancelBtn');
    const close = document.getElementById('passwordChangeCloseBtn');
    if (submit) {
      submit.disabled = submitting;
      submit.textContent = submitting ? 'Updating Password…' : 'Update Password';
    }
    if (cancel) cancel.disabled = submitting;
    if (close) close.disabled = submitting;
  }

  function setMessage(message) {
    const element = document.getElementById('passwordChangeMessage');
    if (element) element.textContent = message;
  }

  function friendlyAuthError(error, stage) {
    const raw = String(error?.message || '').trim();
    if (stage === 'verify' && /invalid login credentials|invalid credentials/i.test(raw)) {
      return 'The current password is incorrect.';
    }
    if (/rate limit|too many requests/i.test(raw)) {
      return 'Too many attempts were made. Wait a few minutes and try again.';
    }
    if (/password should be different|same password/i.test(raw)) {
      return 'The new password must be different from the current password.';
    }
    if (/weak password|password.*characters/i.test(raw)) {
      return 'The new password does not meet the required security rules.';
    }
    if (/session|jwt|not authenticated|auth session missing/i.test(raw)) {
      return 'Your session expired. Sign in again before changing your password.';
    }
    return raw || 'The password could not be changed. Try again.';
  }

  async function submitPasswordChange(event) {
    event.preventDefault();
    clearMessage();

    if (!db || !session?.user) {
      setMessage('Your session is unavailable. Sign in again.');
      return;
    }

    const email = String(session.user.email || profile?.email || '').trim().toLowerCase();
    const currentPassword = document.getElementById('currentAccountPassword').value;
    const newPassword = document.getElementById('newAccountPassword').value;
    const confirmation = document.getElementById('confirmAccountPassword').value;

    if (!email) {
      setMessage('This account has no email address available for password verification.');
      return;
    }
    if (!currentPassword) {
      setMessage('Enter your current password.');
      return;
    }
    if (!updatePasswordRules()) {
      setMessage('Complete all password security requirements.');
      return;
    }
    if (newPassword !== confirmation) {
      setMessage('The new password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setMessage('The new password must be different from the current password.');
      return;
    }

    setSubmitState(true);
    setLoading(true, 'Securing your account…');

    try {
      const verification = await db.auth.signInWithPassword({
        email,
        password: currentPassword
      });
      if (verification.error) throw Object.assign(verification.error, { passwordStage: 'verify' });

      const update = await db.auth.updateUser({ password: newPassword });
      if (update.error) throw Object.assign(update.error, { passwordStage: 'update' });

      const backdrop = document.getElementById('passwordChangeBackdrop');
      backdrop?.classList.add('hidden');
      document.body.classList.remove('password-modal-open');
      resetForm();

      await db.auth.signOut({ scope: 'global' });
      session = null;
      profile = null;
      showAuth('Password changed successfully. Sign in using your new password.');
    } catch (error) {
      console.error('Password change failed:', error?.message || error);
      setMessage(friendlyAuthError(error, error?.passwordStage));
    } finally {
      setLoading(false);
      setSubmitState(false);
    }
  }

  function bindKeyboardControls() {
    document.addEventListener('keydown', (event) => {
      const backdrop = document.getElementById('passwordChangeBackdrop');
      if (event.key === 'Escape' && backdrop && !backdrop.classList.contains('hidden')) {
        const submit = document.getElementById('passwordChangeSubmitBtn');
        if (!submit?.disabled) closeModal();
      }
    });
  }

  installStyles();
  createTrigger();
  createModal();
  bindKeyboardControls();
})();
