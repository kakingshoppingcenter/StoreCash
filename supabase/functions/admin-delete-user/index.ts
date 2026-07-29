import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getSecretKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!raw) throw new Error('Supabase secret key is not available to the Edge Function.')

  const keys = JSON.parse(raw)
  const selected = keys.default ?? Object.values(keys)[0]
  if (typeof selected !== 'string' || !selected) throw new Error('No usable Supabase secret key was found.')
  return selected
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured.')

    const authorization = req.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Authentication is required.' }, 401)

    const token = authorization.slice('Bearer '.length)
    const admin = createClient(supabaseUrl, getSecretKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: callerData, error: callerUserError } = await admin.auth.getUser(token)
    if (callerUserError || !callerData.user) return jsonResponse({ error: 'Invalid or expired session.' }, 401)

    const callerId = callerData.user.id
    const { data: callerProfile, error: callerProfileError } = await admin
      .from('profiles')
      .select('id,full_name,role,active,permissions')
      .eq('id', callerId)
      .single()

    if (callerProfileError || !callerProfile?.active) return jsonResponse({ error: 'Your account is not active.' }, 403)
    if (callerProfile.role !== 'admin') return jsonResponse({ error: 'Only a system administrator can permanently delete users.' }, 403)

    const payload = await req.json().catch(() => ({}))
    if (String(payload.action ?? '') !== 'delete_user') {
      return jsonResponse({ error: 'Unsupported administration action.' }, 400)
    }

    const userId = String(payload.user_id ?? '').trim()
    const confirmationEmail = String(payload.confirmation_email ?? '').trim().toLowerCase()
    if (!userId) return jsonResponse({ error: 'User ID is required.' }, 400)
    if (userId === callerId) return jsonResponse({ error: 'You cannot delete the account currently signed in.' }, 400)

    const { data: targetAuthResult, error: targetAuthError } = await admin.auth.admin.getUserById(userId)
    if (targetAuthError || !targetAuthResult.user) return jsonResponse({ error: 'The selected user no longer exists.' }, 404)

    const targetAuthUser = targetAuthResult.user
    const targetEmail = String(targetAuthUser.email ?? '').trim().toLowerCase()
    if (!targetEmail || confirmationEmail !== targetEmail) {
      return jsonResponse({ error: 'The confirmation email does not match the selected user.' }, 400)
    }

    const { data: targetProfile, error: targetProfileError } = await admin
      .from('profiles')
      .select('id,email,full_name,role,active,branch_id')
      .eq('id', userId)
      .maybeSingle()
    if (targetProfileError) throw targetProfileError

    if (targetProfile?.role === 'admin' && targetProfile.active) {
      const { count: activeAdminCount, error: activeAdminError } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('active', true)
      if (activeAdminError) throw activeAdminError
      if ((activeAdminCount ?? 0) <= 1) {
        return jsonResponse({ error: 'You cannot delete the last active administrator.' }, 409)
      }
    }

    const [reportReference, verificationReference] = await Promise.all([
      admin.from('daily_reports').select('id', { count: 'exact', head: true }).eq('submitted_by', userId),
      admin.from('deposit_verifications').select('id', { count: 'exact', head: true }).eq('verified_by', userId),
    ])

    if (reportReference.error) throw reportReference.error
    if (verificationReference.error) throw verificationReference.error

    const submittedReportCount = reportReference.count ?? 0
    const verificationCount = verificationReference.count ?? 0
    if (submittedReportCount > 0 || verificationCount > 0) {
      const parts = []
      if (submittedReportCount > 0) parts.push(`${submittedReportCount} submitted report${submittedReportCount === 1 ? '' : 's'}`)
      if (verificationCount > 0) parts.push(`${verificationCount} deposit verification${verificationCount === 1 ? '' : 's'}`)
      return jsonResponse({
        error: `This account cannot be deleted because it is connected to ${parts.join(' and ')}.`,
        code: 'USER_HAS_FINANCIAL_RECORDS',
      }, 409)
    }

    const deletedSnapshot = {
      email: targetEmail,
      full_name: targetProfile?.full_name ?? targetAuthUser.user_metadata?.full_name ?? '',
      role: targetProfile?.role ?? 'store_user',
      active: Boolean(targetProfile?.active),
      branch_id: targetProfile?.branch_id ?? null,
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    const { error: auditError } = await admin.from('audit_logs').insert({
      actor_id: callerId,
      actor_name: callerProfile.full_name ?? callerData.user.email ?? 'System Administrator',
      action: 'delete_user',
      entity_type: 'profiles',
      entity_id: userId,
      old_data: deletedSnapshot,
      new_data: null,
    })
    if (auditError) console.error('Unable to record user deletion audit entry:', auditError)

    return jsonResponse({ success: true, user_id: userId })
  } catch (error) {
    console.error('admin-delete-user error:', error)
    const message = error instanceof Error ? error.message : 'Unexpected user deletion error.'
    return jsonResponse({ error: message }, 500)
  }
})
