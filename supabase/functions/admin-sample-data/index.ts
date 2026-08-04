import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const START_DATE = '2026-07-01'
const END_DATE = '2026-07-31'
const DAYS = 31
const CONFIRMATION_PHRASE = 'GENERATE JULY 2026 SAMPLE DATA'

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

async function exactCount(client: SupabaseClient, table: string, configure?: (query: any) => any) {
  let query: any = client.from(table).select('*', { count: 'exact', head: true })
  if (configure) query = configure(query)
  const { count, error } = await query
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
    if (callerProfile.role !== 'admin') return jsonResponse({ error: 'Only a System Administrator can generate sample data.' }, 403)

    const payload = await req.json().catch(() => ({}))
    const action = String(payload.action ?? '')

    if (action === 'preview') {
      const [activeBranches, existingReports] = await Promise.all([
        exactCount(admin, 'branches', (query) => query.eq('active', true)),
        exactCount(admin, 'daily_reports', (query) => query.gte('business_date', START_DATE).lte('business_date', END_DATE)),
      ])

      return jsonResponse({
        period: { from: START_DATE, to: END_DATE, days: DAYS },
        active_branches: activeBranches,
        expected_reports: activeBranches * DAYS,
        existing_reports: existingReports,
        can_generate: activeBranches > 0 && existingReports === 0,
      })
    }

    if (action !== 'generate') return jsonResponse({ error: 'Unsupported sample-data action.' }, 400)

    const confirmation = String(payload.confirmation ?? '').trim()
    const acknowledged = payload.acknowledged === true
    if (confirmation !== CONFIRMATION_PHRASE) return jsonResponse({ error: 'The sample-data confirmation phrase is incorrect.' }, 400)
    if (!acknowledged) return jsonResponse({ error: 'Confirm that the generated records are temporary test data.' }, 400)

    const { data: result, error: generationError } = await admin.rpc('admin_generate_sample_data', {
      p_actor_id: callerId,
      p_start_date: START_DATE,
      p_end_date: END_DATE,
      p_confirmation: confirmation,
    })

    if (generationError) throw generationError
    return jsonResponse({ success: true, ...(result ?? {}) })
  } catch (error) {
    console.error('admin-sample-data error:', error)
    const message = error instanceof Error ? error.message : 'Unexpected sample-data generation error.'
    return jsonResponse({ error: message }, 500)
  }
})
