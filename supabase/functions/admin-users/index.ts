import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowedRoles = new Set(['store_user', 'checker', 'executive', 'admin'])
const paymentTypes = ['cash', 'gcash', 'maya', 'credit', 'debit', 'cheque', 'salmon', 'other'] as const
const allowedPaymentTypes = new Set<string>(paymentTypes)
const fullCheckerScope = Object.freeze({ all: true, payment_types: [...paymentTypes] })
const allowedPermissions = new Set([
  'dashboard_view',
  'entry_view',
  'entry_create',
  'checker_view',
  'checker_verify',
  'reports_view',
  'reports_all_branches',
  'reports_manage',
  'summary_view',
  'audit_view',
  'export_data',
  'manage_branches',
  'manage_users',
])

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

function sanitizePermissions(value: unknown): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result

  for (const [key, permissionValue] of Object.entries(value as Record<string, unknown>)) {
    if (allowedPermissions.has(key) && typeof permissionValue === 'boolean') {
      result[key] = permissionValue
    }
  }
  return result
}

function sanitizeCheckerScope(value: unknown, role: string) {
  if (role !== 'checker') return { ...fullCheckerScope, payment_types: [...fullCheckerScope.payment_types] }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fullCheckerScope, payment_types: [...fullCheckerScope.payment_types] }
  }

  const raw = value as Record<string, unknown>
  const all = raw.all !== false
  if (all) return { ...fullCheckerScope, payment_types: [...fullCheckerScope.payment_types] }

  const selected = Array.isArray(raw.payment_types)
    ? paymentTypes.filter((type) => raw.payment_types?.includes(type) && allowedPaymentTypes.has(type))
    : []

  if (!selected.length) throw new Error('Select at least one payment type for the Deposit Checker.')
  return { all: false, payment_types: selected }
}

function hasManageUsers(profile: { role?: string; permissions?: Record<string, boolean> | null }) {
  return profile.role === 'admin' || profile.permissions?.manage_users === true
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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
      .select('id,role,active,permissions')
      .eq('id', callerId)
      .single()

    if (callerError || !callerProfile?.active) return jsonResponse({ error: 'Your account is not active.' }, 403)
    if (!hasManageUsers(callerProfile)) return jsonResponse({ error: 'You are not authorized to manage users.' }, 403)

    const payload = await req.json().catch(() => ({}))
    const action = String(payload.action ?? '')

    if (action === 'list_users') {
      const authUsers = []
      let page = 1
      const perPage = 1000

      while (page <= 20) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
        if (error) throw error
        authUsers.push(...data.users)
        if (data.users.length < perPage) break
        page += 1
      }

      const { data: profiles, error: profileError } = await admin
        .from('profiles')
        .select('id,email,full_name,role,branch_id,active,permissions,checker_scope,created_at,updated_at')

      if (profileError) throw profileError
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

      const users = authUsers.map((authUser) => {
        const userProfile = profileMap.get(authUser.id)
        return {
          id: authUser.id,
          email: authUser.email ?? userProfile?.email ?? '',
          full_name: userProfile?.full_name ?? authUser.user_metadata?.full_name ?? '',
          role: userProfile?.role ?? 'store_user',
          branch_id: userProfile?.branch_id ?? null,
          active: Boolean(userProfile?.active),
          permissions: userProfile?.permissions ?? {},
          checker_scope: userProfile?.checker_scope ?? fullCheckerScope,
          created_at: authUser.created_at,
          updated_at: userProfile?.updated_at ?? authUser.updated_at,
          last_sign_in_at: authUser.last_sign_in_at ?? null,
        }
      })

      users.sort((a, b) => a.full_name.localeCompare(b.full_name))
      return jsonResponse({ users })
    }

    if (action !== 'create_user' && action !== 'update_user') {
      return jsonResponse({ error: 'Unsupported administration action.' }, 400)
    }

    const email = String(payload.email ?? '').trim().toLowerCase()
    const fullName = String(payload.full_name ?? '').trim()
    const role = String(payload.role ?? '')
    const branchId = payload.branch_id ? String(payload.branch_id) : null
    const active = action === 'create_user' ? true : payload.active !== false
    const permissions = sanitizePermissions(payload.permissions)
    const checkerScope = sanitizeCheckerScope(payload.checker_scope, role)
    const password = payload.password ? String(payload.password) : undefined

    if (!validEmail(email)) return jsonResponse({ error: 'Enter a valid email address.' }, 400)
    if (fullName.length < 2 || fullName.length > 120) return jsonResponse({ error: 'Full name must contain 2 to 120 characters.' }, 400)
    if (!allowedRoles.has(role)) return jsonResponse({ error: 'Invalid user role.' }, 400)
    if (role === 'store_user' && !branchId) return jsonResponse({ error: 'A store user must be assigned to a branch.' }, 400)

    if (branchId) {
      const { data: branch, error: branchError } = await admin.from('branches').select('id').eq('id', branchId).maybeSingle()
      if (branchError) throw branchError
      if (!branch) return jsonResponse({ error: 'The selected branch does not exist.' }, 400)
    }

    if (action === 'create_user') {
      if (!password || password.length < 10) return jsonResponse({ error: 'Temporary password must contain at least 10 characters.' }, 400)

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (createError) throw createError
      if (!created.user) throw new Error('Supabase did not return the newly created user.')

      const { data: createdProfile, error: profileError } = await admin
        .from('profiles')
        .upsert({
          id: created.user.id,
          email,
          full_name: fullName,
          role,
          branch_id: branchId,
          active: true,
          permissions,
          checker_scope: checkerScope,
        }, { onConflict: 'id' })
        .select('id,active')
        .single()

      if (profileError || !createdProfile?.active) {
        await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined)
        throw profileError ?? new Error('Automatic account activation could not be confirmed.')
      }

      return jsonResponse({ success: true, user_id: created.user.id, active: true }, 201)
    }

    const userId = String(payload.user_id ?? '')
    if (!userId) return jsonResponse({ error: 'User ID is required.' }, 400)

    if (userId === callerId) {
      if (!active) return jsonResponse({ error: 'You cannot deactivate your own account.' }, 400)
      if (callerProfile.role === 'admin' && role !== 'admin') {
        return jsonResponse({ error: 'You cannot remove your own administrator role.' }, 400)
      }
      if (callerProfile.role !== 'admin' && permissions.manage_users !== true) {
        return jsonResponse({ error: 'You cannot remove your own user-management access.' }, 400)
      }
    }

    const authChanges: Record<string, unknown> = {
      email,
      user_metadata: { full_name: fullName },
    }
    if (password) {
      if (password.length < 10) return jsonResponse({ error: 'New password must contain at least 10 characters.' }, 400)
      authChanges.password = password
    }

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, authChanges)
    if (authUpdateError) throw authUpdateError

    const { data: updatedProfile, error: profileUpdateError } = await admin
      .from('profiles')
      .update({ email, full_name: fullName, role, branch_id: branchId, active, permissions, checker_scope: checkerScope })
      .eq('id', userId)
      .select('id,active')
      .single()

    if (profileUpdateError || !updatedProfile) throw profileUpdateError ?? new Error('The system profile could not be updated.')
    return jsonResponse({ success: true, user_id: userId, active: Boolean(updatedProfile.active) })
  } catch (error) {
    console.error('admin-users error:', error)
    const message = error instanceof Error ? error.message : 'Unexpected administration error.'
    return jsonResponse({ error: message }, 500)
  }
})
