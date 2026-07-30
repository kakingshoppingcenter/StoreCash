'use strict';

(function installAdminFunctionCompatibility() {
  const FUNCTION_NAME = 'admin-users';

  function functionUrl() {
    const base = String(window.KSC_CONFIG?.supabaseUrl || '').replace(/\/$/, '');
    return `${base}/functions/v1/${FUNCTION_NAME}`;
  }

  function extractMessage(payload, fallback) {
    if (typeof payload === 'string' && payload.trim()) return payload.trim();
    if (payload && typeof payload === 'object') {
      return payload.error || payload.message || payload.msg || fallback;
    }
    return fallback;
  }

  async function ensureCreatedUserIsActive(userId) {
    if (!userId) throw new Error('The user was created without a valid profile identifier.');

    const current = await db
      .from('profiles')
      .select('id,active')
      .eq('id', userId)
      .maybeSingle();

    if (current.error) throw current.error;
    if (current.data?.active === true) return;

    const repaired = await db
      .from('profiles')
      .update({ active: true })
      .eq('id', userId)
      .select('id,active')
      .maybeSingle();

    if (repaired.error) throw repaired.error;
    if (!repaired.data?.active) {
      throw new Error('The account was created, but automatic activation could not be confirmed. Select the user and activate the account before sharing its login.');
    }
  }

  friendlyFunctionError = function improvedFunctionError(error) {
    const raw = String(error?.message || 'Administration request failed.');

    if (/invalid jwt|jwt verification|legacy jwt|signature verification/i.test(raw)) {
      return 'Supabase rejected the session token before the function could run. Open Edge Functions > admin-users > Settings, disable Verify JWT, deploy the function again, then sign out and sign in.';
    }
    if (/invalid or expired session|missing authorization|authentication is required|unauthorized|401/i.test(raw)) {
      return 'Your login session is no longer valid. Sign out, sign in again, and retry.';
    }
    if (/secret key is not available|no usable supabase secret key|SUPABASE_URL is not configured/i.test(raw)) {
      return 'The admin-users function is running, but its Supabase server environment is incomplete. Check Edge Functions > admin-users > Logs and project secrets.';
    }
    if (/column .*?(email|permissions).*?does not exist|schema cache|relation .* does not exist/i.test(raw)) {
      return 'The administration database extension is incomplete. Run supabase/admin_extension.sql in the Supabase SQL Editor.';
    }
    if (/failed to fetch|networkerror|load failed|cors/i.test(raw)) {
      return 'The browser could not reach the admin-users function. Confirm the function is deployed in project cdmghdexjcqcmrwnbglw and review its Invocations and Logs.';
    }
    if (/404|function not found|not found/i.test(raw)) {
      return 'The Edge Function named admin-users was not found in the configured Supabase project. Deploy it with that exact name.';
    }
    return raw;
  };

  invokeAdminUsers = async function invokeAdminUsersExplicitly(payload) {
    const creatingUser = payload?.action === 'create_user';
    const requestPayload = creatingUser ? { ...payload, active: true } : payload;

    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw new Error(sessionError.message || 'Unable to read the current login session.');

    const activeSession = sessionData?.session;
    if (!activeSession?.access_token) {
      throw new Error('Your login session is no longer valid. Sign out, sign in again, and retry.');
    }

    const response = await fetch(functionUrl(), {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${activeSession.access_token}`,
        apikey: window.KSC_CONFIG.supabasePublishableKey,
        'Content-Type': 'application/json',
        'x-client-info': 'kaking-store-cash-web/1.1'
      },
      body: JSON.stringify(requestPayload)
    });

    const responseText = await response.text();
    let responseData = null;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch (_) {
      responseData = responseText;
    }

    if (!response.ok) {
      const serverMessage = extractMessage(responseData, `admin-users returned HTTP ${response.status}.`);
      throw new Error(`${serverMessage} [HTTP ${response.status}]`);
    }

    if (responseData?.error) throw new Error(responseData.error);
    if (creatingUser) await ensureCreatedUserIsActive(responseData?.user_id);
    return responseData || {};
  };

  function installAutomaticActivationInterface() {
    const form = document.getElementById('userAdminForm');
    const activeControl = document.getElementById('userActive');
    if (!form || !activeControl) return;

    const label = activeControl.closest('.switch-line');
    if (label && !label.querySelector('[data-auto-activation-note]')) {
      const note = document.createElement('small');
      note.dataset.autoActivationNote = 'true';
      note.textContent = 'New accounts activate automatically';
      note.style.display = 'block';
      note.style.marginLeft = '6px';
      note.style.color = '#66758a';
      note.style.fontWeight = '500';
      label.appendChild(note);
    }

    form.addEventListener('submit', () => {
      if (!selectedAdminUserId) activeControl.checked = true;
    }, true);
  }

  installAutomaticActivationInterface();
})();

(function loadProtectedBranchDeletion() {
  if (document.querySelector('script[data-ksc-branch-delete]')) return;
  const script = document.createElement('script');
  script.src = './branch-delete.js?v=20260729-1845';
  script.dataset.kscBranchDelete = 'true';
  script.async = false;
  document.body.appendChild(script);
})();

(function loadProtectedOperationalReset() {
  if (document.querySelector('script[data-ksc-operational-reset]')) return;
  const script = document.createElement('script');
  script.src = './admin-reset.js?v=20260730-0929';
  script.dataset.kscOperationalReset = 'true';
  script.async = false;
  document.body.appendChild(script);
})();
