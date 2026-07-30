import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CONFIRMATION_PHRASE = 'RESET ALL RECORDS'

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

async function exactCount(client: SupabaseClient, table: string) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return Number(count ?? 0)
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

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return jsonResponse({ error: 'Invalid or expired session.' }, 401)

    const callerId = userData.user.id
    const { data: callerProfile, error: callerError } = await admin
      .from('profiles')
      .select('id,full_name,role,active')
      .eq('id', callerId)
      .single()

    if (callerError || !callerProfile?.active) return jsonResponse({ error: 'Your account is not active.' }, 403)
    if (callerProfile.role !== 'admin') return jsonResponse({ error: 'Only a System Administrator can reset operational records.' }, 403)

    const payload = await req.json().catch(() => ({}))
    const action = String(payload.action ?? '')

    if (action === 'preview') {
      const [reports, verifications, auditLogs] = await Promise.all([
        exactCount(admin, 'daily_reports'),
        exactCount(admin, 'deposit_verifications'),
        exactCount(admin, 'audit_logs'),
      ])

      const { data: lastReset, error: lastResetError } = await admin
        .from('audit_logs')
        .select('created_at')
        .eq('action', 'system_reset')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastResetError) throw lastResetError
      return jsonResponse({
        counts: { reports, verifications, audit_logs: auditLogs },
        last_reset_at: lastReset?.created_at ?? null,
      })
    }

    if (action !== 'reset') return jsonResponse({ error: 'Unsupported reset action.' }, 400)

    const confirmation = String(payload.confirmation ?? '').trim()
    const reason = String(payload.reason ?? '').trim()
    const acknowledged = payload.acknowledged === true

    if (confirmation !== CONFIRMATION_PHRASE) return jsonResponse({ error: 'The confirmation phrase is incorrect.' }, 400)
    if (!acknowledged) return jsonResponse({ error: 'The irreversible reset acknowledgement is required.' }, 400)
    if (reason.length < 10 || reason.length > 500) return jsonResponse({ error: 'The reset reason must contain 10 to 500 characters.' }, 400)

    const { data: result, error: resetError } = await admin.rpc('admin_reset_operational_data', {
      p_actor_id: callerId,
      p_reason: reason,
      p_confirmation: confirmation,
    })

    if (resetError) throw resetError
    return jsonResponse({ success: true, ...(result ?? {}) })
  } catch (error) {
    console.error('admin-reset-data error:', error)
    const message = error instanceof Error ? error.message : 'Unexpected protected reset error.'
    return jsonResponse({ error: message }, 500)
  }
})
