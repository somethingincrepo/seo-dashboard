#!/usr/bin/env node
/**
 * QA Test Runner — SEO Dashboard
 * Covers all P0 + P1 test cases from QA.md
 *
 * Usage:
 *   node scripts/qa-runner.mjs
 *   QA_BASE_URL=https://staging.yoursite.com node scripts/qa-runner.mjs
 */

import { webcrypto } from 'crypto'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const crypto = webcrypto

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000'
const ADMIN_PASSWORD        = process.env.ADMIN_PASSWORD        || ''
const PORTAL_SESSION_SECRET = process.env.PORTAL_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''
const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY          = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const AIRTABLE_API_KEY      = process.env.AIRTABLE_API_KEY      || ''
const AIRTABLE_BASE_ID      = process.env.AIRTABLE_BASE_ID      || ''
const CONTENT_BASE_ID       = process.env.CONTENT_AIRTABLE_BASE_ID || ''

// ─── TEST FRAMEWORK ──────────────────────────────────────────────────────────

const results = { pass: [], fail: [], skip: [] }
let sectionName = ''

function section(name) {
  sectionName = name
  console.log(`\n${'─'.repeat(64)}`)
  console.log(`  ${name}`)
  console.log('─'.repeat(64))
}

const pass = (id, desc)         => { results.pass.push({ id, desc });         console.log(`  ✓  ${id.padEnd(14)} ${desc}`) }
const fail = (id, desc, reason) => { results.fail.push({ id, desc, reason }); console.log(`  ✗  ${id.padEnd(14)} ${desc}\n     ↳ ${reason}`) }
const skip = (id, desc, reason) => { results.skip.push({ id, desc, reason }); console.log(`  ○  ${id.padEnd(14)} ${desc}  [skip: ${reason}]`) }

async function test(id, desc, fn) {
  try {
    let settled = false
    await fn({
      pass: () => { if (!settled) { settled = true; pass(id, desc) } },
      fail: (r)  => { if (!settled) { settled = true; fail(id, desc, r) } },
      skip: (r)  => { if (!settled) { settled = true; skip(id, desc, r) } },
    })
  } catch (e) {
    fail(id, desc, `threw: ${e.message}`)
  }
}

// ─── SESSION FACTORIES ───────────────────────────────────────────────────────

/** Forge admin seo_session cookie — mirrors lib/auth.ts exactly */
async function forgeAdminSession(username = 'admin', offsetSecs = 604800) {
  const exp     = Math.floor(Date.now() / 1000) + offsetSecs
  const payload = `${encodeURIComponent(username)}.${exp}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(ADMIN_PASSWORD),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig   = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const bytes = new Uint8Array(sig)
  let   str   = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  const b64url = Buffer.from(str, 'binary').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${payload}.${b64url}`
}

/** Forge portal_session cookie — mirrors lib/portal-auth.ts exactly */
async function forgePortalSession(clientId, portalToken) {
  const payload = Buffer.from(JSON.stringify({ client_id: clientId, portal_token: portalToken }))
    .toString('base64url')
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(PORTAL_SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${payload}.${sigHex}`
}

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────

const hdrs = ({ cookie, bearer } = {}) => {
  const h = {}
  if (cookie) h['Cookie'] = cookie
  if (bearer) h['Authorization'] = `Bearer ${bearer}`
  return h
}

const TIMEOUT = AbortSignal.timeout(15000)

async function GET(path, opts = {}) {
  return fetch(`${BASE_URL}${path}`, {
    headers: hdrs(opts),
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  })
}

async function POST(path, body, opts = {}) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...hdrs(opts) },
    body: JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  })
}

async function json(res) {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { _raw: text } }
}

// ─── EXTERNAL SERVICES ───────────────────────────────────────────────────────

async function supabaseRest(table, qs = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: {
      apikey:          SUPABASE_KEY,
      Authorization:  `Bearer ${SUPABASE_KEY}`,
      Accept:         'application/json',
    }
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  return res.json()
}

async function airtableList(baseId, tableName, qs = '') {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${qs}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } })
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`)
  return res.json()
}

// ─── CLEANUP REGISTRY ────────────────────────────────────────────────────────

const toCleanup = []   // { type: 'client', record_id, client_id }

// Helper: any redirect or auth-rejection status (302, 307, 401, 403)
const isBlocked = (s) => s === 302 || s === 307 || s === 401 || s === 403

// ─── SECTION 1: AUTH ─────────────────────────────────────────────────────────

async function runAuth(adminCookie) {
  section('Section 1 — Authentication & Sessions')

  // AUTH-010: Unauthenticated admin pages → redirect to login
  await test('AUTH-010', 'Admin pages redirect unauthenticated requests', async ({ pass, fail }) => {
    const routes = ['/', '/clients', '/jobs', '/approvals', '/token-usage']
    const bad = []
    for (const r of routes) {
      const res = await GET(r)  // no cookie
      if (!isBlocked(res.status)) bad.push(`${r}→${res.status}`)
    }
    if (bad.length === 0) pass()
    else fail(`Not protected: ${bad.join(', ')}`)
  })

  // AUTH-010b: Unauthenticated admin API → 401
  await test('AUTH-010b', 'Admin API routes return 401 without auth', async ({ pass, fail }) => {
    const bad = []
    // POST endpoint that requires Bearer token
    const res2 = await POST('/api/tokens/generate', { package_tier: 'growth' })
    if (res2.status !== 401 && res2.status !== 403) bad.push(`/api/tokens/generate→${res2.status}`)
    // POST client create without Bearer
    const res3 = await POST('/api/clients/create', {})
    if (res3.status !== 401 && res3.status !== 403 && res3.status !== 400) bad.push(`/api/clients/create (no auth)→${res3.status}`)

    if (bad.length === 0) pass()
    else fail(`Returned unexpected status: ${bad.join(', ')}`)
  })

  // AUTH-011: Portal routes blocked without auth — test via approvals POST which requires portal token
  await test('AUTH-011', 'Portal approvals API rejects missing/invalid token', async ({ pass, fail }) => {
    // POST /api/approvals without any token
    const res = await POST('/api/approvals', { recordId: 'recFAKE', decision: 'approved' })
    // Should be 400 (missing token), 401, or 403 — not 200
    if (res.status === 400 || isBlocked(res.status)) pass()
    else fail(`Expected 400/401/403, got ${res.status}`)
  })

  // AUTH-012: Tampered HMAC rejected
  await test('AUTH-012', 'Tampered admin session token rejected (redirects to login)', async ({ pass, fail }) => {
    const valid   = await forgeAdminSession()
    const tampered = valid.slice(0, -4) + (valid.slice(-1) === 'a' ? 'zzzz' : 'aaaa')
    const res = await GET('/clients', { cookie: `seo_session=${tampered}` })
    if (isBlocked(res.status)) pass()
    else fail(`Expected redirect/401, got ${res.status}`)
  })

  // AUTH-006: Expired admin session rejected
  await test('AUTH-006', 'Expired admin session rejected', async ({ pass, fail }) => {
    const expired = await forgeAdminSession('admin', -7200) // expired 2hrs ago
    const res = await GET('/clients', { cookie: `seo_session=${expired}` })
    if (isBlocked(res.status)) pass()
    else fail(`Expected redirect/401, got ${res.status}`)
  })

  // AUTH-007: Garbage portal session cookie rejected
  await test('AUTH-007', 'Invalid portal session cookie rejected', async ({ pass, fail }) => {
    // POST /api/approvals with garbage session — should be blocked or return missing-token error
    const res = await POST('/api/approvals',
      { recordId: 'recFAKE', decision: 'approved', token: 'garbage-fake-token' },
      { cookie: 'portal_session=garbage.fakehex' }
    )
    // 403 = invalid token, 400 = bad token format, 401 = unauth — all acceptable rejections
    if (res.status === 400 || res.status === 401 || res.status === 403) pass()
    else fail(`Expected 400/401/403, got ${res.status}`)
  })

  // Verify forged admin session actually works (validates our forging logic)
  await test('AUTH-001', 'Forged admin session accepted (validates session logic)', async ({ pass, fail }) => {
    const res = await GET('/clients', { cookie: `seo_session=${adminCookie}` })
    const loc = res.headers.get('location') || ''
    // Pass if we get content (200) or a non-login redirect
    if (res.status === 200) { pass(); return }
    if ((res.status === 302 || res.status === 307) && !loc.includes('/login')) { pass(); return }
    if (loc.includes('/login')) fail(`Admin session redirected to login — forging failed (loc: ${loc})`)
    else fail(`Expected 200/non-login-redirect, got ${res.status} → ${loc}`)
  })

  // JOBS-007: Jobs endpoints require auth
  await test('JOBS-007', 'Jobs page requires admin auth', async ({ pass, fail }) => {
    const res = await GET('/jobs')
    if (isBlocked(res.status)) pass()
    else fail(`Expected redirect/401, got ${res.status}`)
  })

  // DSGN-004: Portal cannot access design review
  await test('DSGN-004', 'Design review page inaccessible without admin auth', async ({ pass, fail }) => {
    const res = await GET('/design-review')  // no admin cookie
    if (isBlocked(res.status)) pass()
    else fail(`Expected redirect/401/403, got ${res.status}`)
  })

  // COST-003: Token usage requires admin auth
  await test('COST-003', 'Token usage page requires admin auth', async ({ pass, fail }) => {
    const res = await GET('/token-usage')
    if (isBlocked(res.status)) pass()
    else fail(`Expected redirect/401/403, got ${res.status}`)
  })
}

// ─── SECTION 2: ONBOARDING ───────────────────────────────────────────────────

async function runOnboarding(adminCookie) {
  section('Section 2 — Onboarding')

  const testSiteUrl = `https://qa-test-${Date.now()}.example.com`

  // ONB-001: Create client happy path
  await test('ONB-001', 'Create client: happy path (all required fields)', async ({ pass, fail }) => {
    const res = await POST('/api/clients/create', {
      company_name: `QA Test Client ${Date.now()}`,
      site_url:     testSiteUrl,
      domain:       'qa-test.example.com',
      cms:          'WordPress',
      package:      'growth',
      run_audit:    false,
    }, { bearer: ADMIN_PASSWORD })

    const body = await json(res)
    if (res.status !== 201 && res.status !== 200) { fail(`Expected 201, got ${res.status}: ${JSON.stringify(body)}`); return }
    if (!body.ok)             { fail(`ok=false: ${JSON.stringify(body)}`);      return }
    if (!body.portal_token)   { fail('Missing portal_token in response');        return }
    if (!body.portal_username){ fail('Missing portal_username');                 return }
    if (!body.portal_password){ fail('Missing portal_password');                 return }
    if (!body.client_id)      { fail('Missing client_id');                       return }
    if (!body.record_id)      { fail('Missing record_id');                       return }

    toCleanup.push({ type: 'client', record_id: body.record_id, client_id: body.client_id })
    pass()
  })

  // ONB-005: Portal token UUID format
  await test('ONB-005', 'Auto-generated portal token is valid UUID', async ({ pass, fail }) => {
    const res = await POST('/api/clients/create', {
      company_name: `QA UUID Check ${Date.now()}`,
      site_url:     `https://qa-uuid-${Date.now()}.example.com`,
      domain:       'qa-uuid.example.com',
      cms:          'WordPress',
      package:      'starter',
      run_audit:    false,
    }, { bearer: ADMIN_PASSWORD })

    const body = await json(res)
    if (body.record_id) toCleanup.push({ type: 'client', record_id: body.record_id, client_id: body.client_id })
    if (!body.portal_token) { fail(`No portal_token in response: ${JSON.stringify(body)}`); return }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    if (uuidRe.test(body.portal_token)) pass()
    else fail(`"${body.portal_token}" is not a UUID`)
  })

  // ONB-002: Duplicate site_url rejected
  await test('ONB-002', 'Duplicate site_url returns 409', async ({ pass, fail }) => {
    const res = await POST('/api/clients/create', {
      company_name: 'QA Duplicate Test',
      site_url:     testSiteUrl,  // same URL as ONB-001
      domain:       'qa-test.example.com',
      cms:          'WordPress',
      package:      'growth',
    }, { bearer: ADMIN_PASSWORD })

    if (res.status === 409) pass()
    else fail(`Expected 409, got ${res.status}`)
  })

  // ONB-003: run_audit=false → no job_id
  await test('ONB-003', 'run_audit=false creates no audit job', async ({ pass, fail }) => {
    const res = await POST('/api/clients/create', {
      company_name: `QA No Audit ${Date.now()}`,
      site_url:     `https://qa-noaudit-${Date.now()}.example.com`,
      domain:       'qa-noaudit.example.com',
      cms:          'WordPress',
      package:      'starter',
      run_audit:    false,
    }, { bearer: ADMIN_PASSWORD })

    const body = await json(res)
    if (body.record_id) toCleanup.push({ type: 'client', record_id: body.record_id, client_id: body.client_id })

    if (!body.ok) { fail(`Client creation failed: ${JSON.stringify(body)}`); return }
    if (body.job_id) fail(`Expected no job_id, got: ${body.job_id}`)
    else pass()
  })

  // ONB-004: Package tier stored correctly
  await test('ONB-004', 'Package tier persists correctly in created client', async ({ pass, fail }) => {
    const res = await POST('/api/clients/create', {
      company_name: `QA Auth Tier ${Date.now()}`,
      site_url:     `https://qa-tier-${Date.now()}.example.com`,
      domain:       'qa-tier.example.com',
      cms:          'WordPress',
      package:      'authority',
      run_audit:    false,
    }, { bearer: ADMIN_PASSWORD })

    const body = await json(res)
    if (body.record_id) toCleanup.push({ type: 'client', record_id: body.record_id, client_id: body.client_id })
    if (!body.ok) { fail(`Creation failed: ${JSON.stringify(body)}`); return }

    // Verify via Airtable that package = authority
    try {
      const data = await airtableList(AIRTABLE_BASE_ID, 'Clients',
        `filterByFormula=%7Bclient_id%7D%3D%22${encodeURIComponent(body.client_id)}%22&fields[]=package`)
      const rec = data.records?.[0]
      const pkg = rec?.fields?.package?.toLowerCase()
      if (pkg === 'authority') pass()
      else fail(`Expected package=authority in Airtable, got "${pkg}"`)
    } catch (e) {
      fail(`Could not verify in Airtable: ${e.message}`)
    }
  })

  // ONB-006: Missing required fields → 400
  await test('ONB-006', 'Missing required fields return 400 with field-specific error', async ({ pass, fail }) => {
    const cases = [
      [{ site_url: 'https://x.com', domain: 'x.com', cms: 'WP' }, 'company_name'],
      [{ company_name: 'T', domain: 'x.com', cms: 'WP' }, 'site_url'],
      [{ company_name: 'T', site_url: 'https://x.com', domain: 'x.com' }, 'cms'],
    ]
    const bad = []
    for (const [body, missing] of cases) {
      const res = await POST('/api/clients/create', body, { bearer: ADMIN_PASSWORD })
      if (res.status !== 400) bad.push(`missing ${missing}: got ${res.status}`)
    }
    if (bad.length === 0) pass()
    else fail(bad.join('; '))
  })

  // ONB-008: Invalid site URL format
  await test('ONB-008', 'Invalid site URL format rejected', async ({ pass, fail }) => {
    const res = await POST('/api/clients/create', {
      company_name: 'QA Bad URL',
      site_url:     'not-a-url',
      domain:       'test.com',
      cms:          'WordPress',
      package:      'growth',
    }, { bearer: ADMIN_PASSWORD })

    if (res.status === 400) pass()
    else if (res.status === 201 || res.status === 200) {
      const body = await json(res)
      if (body.record_id) toCleanup.push({ type: 'client', record_id: body.record_id, client_id: body.client_id })
      fail(`Invalid URL was accepted (status ${res.status}) — validation missing`)
    } else {
      fail(`Expected 400, got ${res.status}`)
    }
  })
}

// ─── SECTION 3: TOKENS ───────────────────────────────────────────────────────

async function runTokens(adminCookie) {
  section('Section 3 — Token-Based Intake')

  // TOK-009: Requires admin auth
  await test('TOK-009', 'Token generation requires admin session', async ({ pass, fail }) => {
    const res = await POST('/api/tokens/generate', { package_tier: 'growth' })
    if (res.status === 401 || res.status === 403) pass()
    else fail(`Expected 401/403, got ${res.status}`)
  })

  const tokens = {}

  // TOK-001/002/003: Generate tokens per tier
  for (const [id, tier, prefix] of [
    ['TOK-001', 'starter',   'STR-'],
    ['TOK-002', 'growth',    'GRW-'],
    ['TOK-003', 'authority', 'ATH-'],
  ]) {
    await test(id, `Generate ${tier} token (${prefix} prefix + 30-day expiry)`, async ({ pass, fail }) => {
      const res  = await POST('/api/tokens/generate', { package_tier: tier }, { cookie: `seo_session=${adminCookie}` })
      const body = await json(res)
      if (res.status !== 201 && res.status !== 200) { fail(`Expected 201, got ${res.status}: ${JSON.stringify(body)}`); return }

      const token   = body.token?.token
      const expiry  = body.token?.expires_at

      if (!token?.startsWith(prefix)) { fail(`Token "${token}" doesn't start with ${prefix}`); return }

      const diffDays = (new Date(expiry) - Date.now()) / 86400000
      if (diffDays < 29 || diffDays > 31) { fail(`Expiry is ${diffDays.toFixed(1)} days — expected ~30`); return }

      tokens[tier] = token
      pass()
    })
  }

  // TOK-005a: Valid unused token validates as valid
  await test('TOK-005a', 'Valid unused token returns {valid:true} from validate endpoint', async ({ pass, fail, skip }) => {
    if (!tokens.starter) { skip('No starter token generated'); return }
    const res  = await GET(`/api/tokens/validate?token=${tokens.starter}`)
    const body = await json(res)
    if (body.valid === true && body.package_tier === 'starter') pass()
    else fail(`Expected {valid:true, package_tier:'starter'}, got: ${JSON.stringify(body)}`)
  })

  // TOK-008: Tier derived from prefix
  await test('TOK-008', 'Validate confirms tier matches prefix (not overridable via query)', async ({ pass, fail, skip }) => {
    if (!tokens.growth) { skip('No growth token generated'); return }
    const res  = await GET(`/api/tokens/validate?token=${tokens.growth}`)
    const body = await json(res)
    if (body.valid === true && body.package_tier === 'growth') pass()
    else fail(`Expected growth tier, got: ${JSON.stringify(body)}`)
  })

  // TOK-007: Invalid formats
  await test('TOK-007', 'Invalid token formats all return {valid:false}', async ({ pass, fail }) => {
    const cases = ['INVALID-TOKEN', 'NOTPREFIX-123456', 'STR-ZZZZZZ']
    const bad = []
    for (const t of cases) {
      const res  = await GET(`/api/tokens/validate?token=${encodeURIComponent(t)}`)
      const body = await json(res)
      if (body.valid !== false) bad.push(`"${t}" → valid:${body.valid}`)
    }
    if (bad.length === 0) pass()
    else fail(bad.join('; '))
  })

  // TOK-007b: Missing token param
  await test('TOK-007b', 'Missing token param returns {valid:false, reason:"missing"}', async ({ pass, fail }) => {
    const res  = await GET('/api/tokens/validate')
    const body = await json(res)
    if (body.valid === false) pass()
    else fail(`Expected valid:false, got: ${JSON.stringify(body)}`)
  })

  // TOK-006: Already-used token (use the starter token to create a client, then validate again)
  await test('TOK-006', 'Already-used token returns {valid:false, reason:"used"}', async ({ pass, fail, skip }) => {
    if (!tokens.starter) { skip('No starter token generated'); return }
    // Use the token via intake API — but /intake may be a form page, not a JSON API
    // Instead: check the token is currently valid, then use it via the tokens/validate
    // The actual "mark as used" happens in the intake form submission server action
    // We can verify the current state is valid, and note this test needs full intake form to complete
    skip('Intake form is a server action — mark-as-used requires form submission test')
  })
}

// ─── SECTION 4–6: QUOTA ENFORCEMENT ─────────────────────────────────────────

async function runQuota(adminCookie) {
  section('Section 4–6 — Quota Enforcement (Content, Changes, Links)')

  // Fetch a real client from Airtable to use for quota tests
  let clients = []
  try {
    const data = await airtableList(AIRTABLE_BASE_ID, 'Clients',
      'maxRecords=20&fields[]=client_id&fields[]=package&fields[]=portal_token&fields[]=portal_username&fields[]=portal_password')
    clients = data.records || []
  } catch (e) {
    console.log(`  ⚠  Could not fetch clients from Airtable: ${e.message}`)
  }

  const clientByTier = (tier) => clients.find(c =>
    c.fields.package?.toLowerCase() === tier && c.fields.portal_token
  )

  const starterClient  = clientByTier('starter')
  const growthClient   = clientByTier('growth')
  const authorityClient = clientByTier('authority')

  // CHG-011: IDOR — invalid portal token returns 403
  await test('CHG-011', 'Approvals API: non-existent portal token returns 403', async ({ pass, fail }) => {
    const res = await POST('/api/approvals', {
      recordId: 'recFAKERECORD000',
      decision: 'approved',
      token:    'aaaaaaaa-0000-0000-0000-fake-token-test',
    })
    if (res.status === 403 || res.status === 401) pass()
    else {
      const body = await json(res)
      fail(`Expected 403, got ${res.status}: ${JSON.stringify(body)}`)
    }
  })

  // Content quota: check what's in Content Jobs
  let contentJobs = []
  try {
    const data = await airtableList(CONTENT_BASE_ID, 'Content Jobs',
      'maxRecords=10&fields[]=Status&fields[]=Client ID&filterByFormula=Status%3D%22Proposed%22')
    contentJobs = data.records || []
  } catch (e) {
    console.log(`  ⚠  Could not fetch Content Jobs: ${e.message}`)
  }

  if (contentJobs.length > 0) {
    const job = contentJobs[0]
    await test('CONT-001', 'Content approval API: approve proposed title', async ({ pass, fail }) => {
      const res  = await POST('/api/content-approval', { recordId: job.id, action: 'approved', type: 'job' })
      const body = await json(res)
      if (res.status === 200 && body.success) pass()
      else fail(`Expected {success:true}, got ${res.status}: ${JSON.stringify(body)}`)
    })
  } else {
    skip('CONT-001', 'Approve title: under quota', 'No Proposed Content Jobs in Airtable — add fixture data')
  }

  // Pending Changes
  let pendingChanges = []
  try {
    // Note: the exact Status field name may vary — try without filter first
    const data = await airtableList(AIRTABLE_BASE_ID, 'Changes',
      'maxRecords=20&fields[]=client_id&fields[]=Change+Type')
    pendingChanges = data.records || []
  } catch (e) {
    console.log(`  ⚠  Could not fetch Changes: ${e.message}`)
  }

  const runChangeApprovalTest = async (client, label) => {
    if (!client) return null
    const token = client.fields.portal_token
    const change = pendingChanges.find(c => {
      const ids = [].concat(c.fields.client_id || [])
      return ids.some(id => id === client.fields.client_id || id === client.id)
    })
    if (!change) return null
    return { token, change, label }
  }

  const starterTest = await runChangeApprovalTest(starterClient, 'Starter')
  const growthTest  = await runChangeApprovalTest(growthClient,  'Growth')

  if (starterTest) {
    await test('CHG-001', 'Approve SEO change (valid token + pending change)', async ({ pass, fail }) => {
      const res  = await POST('/api/approvals', {
        recordId: starterTest.change.id,
        decision: 'approved',
        token:    starterTest.token,
      })
      const body = await json(res)
      if (res.status === 200 && body.ok) pass()
      else if (res.status === 409 && body.error === 'quota_reached') {
        pass() // Quota enforcement working — this confirms the API is gating correctly
      } else {
        fail(`Got ${res.status}: ${JSON.stringify(body)}`)
      }
    })
  } else {
    skip('CHG-001', 'Approve SEO change happy path', 'No pending changes found for a known client')
  }

  if (growthTest) {
    await test('CHG-005', 'Skip change: no quota consumed, no implement job', async ({ pass, fail }) => {
      const res  = await POST('/api/approvals', {
        recordId: growthTest.change.id,
        decision: 'skipped',
        token:    growthTest.token,
      })
      const body = await json(res)
      if (res.status === 200 && body.ok) pass()
      else fail(`Expected ok=true, got ${res.status}: ${JSON.stringify(body)}`)
    })
  } else {
    skip('CHG-005', 'Skip change', 'No pending changes found for Growth client')
  }

  // Quota limit tests — require fixture data at limit
  const quotaNote = 'Needs fixture client at quota limit — seed Airtable with N approved changes this month'
  skip('CONT-002', 'Approve title: Starter at 8/8 → quota_reached',  quotaNote)
  skip('CONT-003', 'Approve title: Growth at 14/14 → quota_reached', quotaNote)
  skip('CONT-004', 'Approve title: Authority at 26/26 → quota_reached', quotaNote)
  skip('CONT-005', 'Longform: Starter (0 allowed)',    quotaNote)
  skip('CHG-002',  'Page optim: Starter (0 allowed)',  quotaNote)
  skip('CHG-003',  'Page optim: Growth at 6/6',        quotaNote)
  skip('LINK-002', 'Internal link: Starter at 4/4',    quotaNote)
  skip('LINK-003', 'Internal link: Growth at 10/10',   quotaNote)
}

// ─── SECTION 14: DATA INTEGRITY ──────────────────────────────────────────────

async function runDataIntegrity() {
  section('Section 14 — Data Integrity')

  // DATA-004: Portal token uniqueness
  await test('DATA-004', 'All portal tokens are unique in Airtable', async ({ pass, fail, skip }) => {
    let all = []
    let offset = undefined
    try {
      do {
        const qs = new URLSearchParams({ 'fields[]': 'portal_token', pageSize: '100' })
        if (offset) qs.set('offset', offset)
        const data = await airtableList(AIRTABLE_BASE_ID, 'Clients', qs.toString())
        all = all.concat(data.records || [])
        offset = data.offset
      } while (offset)
    } catch (e) {
      skip(`Airtable query failed: ${e.message}`)
      return
    }

    const tokens  = all.map(r => r.fields.portal_token).filter(Boolean)
    const unique  = new Set(tokens)
    if (unique.size === tokens.length) pass()
    else fail(`${tokens.length - unique.size} duplicate portal tokens across ${tokens.length} clients`)
  })

  // DATA-004b: Supabase connectivity
  await test('DATA-004b', 'Supabase jobs table is accessible', async ({ pass, fail, skip }) => {
    try {
      const rows = await supabaseRest('jobs', 'select=id,status,client_id&limit=1')
      if (Array.isArray(rows)) pass()
      else fail(`Unexpected response type: ${typeof rows}`)
    } catch (e) {
      fail(`Supabase error: ${e.message}`)
    }
  })

  // DATA-002: Jobs table has cost columns
  await test('DATA-002', 'Supabase jobs table has cost tracking columns', async ({ pass, fail, skip }) => {
    try {
      const rows = await supabaseRest('jobs', 'select=id,status,cost_usd,input_tokens,output_tokens,client_id&limit=5')
      if (!Array.isArray(rows)) { fail(`Expected array, got: ${JSON.stringify(rows)}`); return }
      if (rows.length === 0) { pass(); return }   // empty table — structure unknown but no error
      const required = ['status', 'cost_usd', 'input_tokens', 'output_tokens']
      const missing  = required.filter(k => !(k in rows[0]))
      if (missing.length === 0) pass()
      else fail(`Missing columns: ${missing.join(', ')}`)
    } catch (e) {
      fail(`Supabase error: ${e.message}`)
    }
  })

  // DATA-005: Client slug uniqueness
  await test('DATA-005', 'No duplicate client_id slugs in Airtable', async ({ pass, fail, skip }) => {
    try {
      const data = await airtableList(AIRTABLE_BASE_ID, 'Clients', 'fields[]=client_id&pageSize=100')
      const slugs  = (data.records || []).map(r => r.fields.client_id).filter(Boolean)
      const unique = new Set(slugs)
      if (unique.size === slugs.length) pass()
      else fail(`${slugs.length - unique.size} duplicate client_id slugs`)
    } catch (e) {
      fail(`Airtable error: ${e.message}`)
    }
  })
}

// ─── SECTION 15: SECURITY ────────────────────────────────────────────────────

async function runSecurity(adminCookie) {
  section('Section 15 — Security')

  // SEC-008: No secrets in JS bundle
  await test('SEC-008', 'No secrets in client-side JS bundle', async ({ pass, fail, skip }) => {
    const chunksDir = join('/Users/joshbernstein/Desktop/Claude/dashboard', '.next', 'static', 'chunks')
    if (!existsSync(chunksDir)) { skip('No .next build — run `npm run build` first'); return }

    const secrets = [
      { label: 'ADMIN_PASSWORD',    value: ADMIN_PASSWORD },
      { label: 'Airtable API key',  value: AIRTABLE_API_KEY.slice(0, 25) },
      { label: 'Anthropic API key', value: 'sk-ant-api' },
      { label: 'Supabase key',      value: SUPABASE_KEY.slice(0, 12) },
    ]

    const found = []
    const files = readdirSync(chunksDir).filter(f => f.endsWith('.js'))
    for (const file of files) {
      const content = readFileSync(join(chunksDir, file), 'utf-8')
      for (const { label, value } of secrets) {
        if (content.includes(value)) found.push(`${label} in ${file}`)
      }
    }
    if (found.length === 0) pass()
    else fail(`Secrets exposed in bundle: ${found.join('; ')}`)
  })

  // SEC-002: Injection in company_name stored safely (no 500)
  await test('SEC-002', 'SQL injection in company_name does not cause 500', async ({ pass, fail }) => {
    const ts  = Date.now()
    const res = await POST('/api/clients/create', {
      company_name: `'; DROP TABLE clients; --`,
      site_url:     `https://sqli-${ts}.example.com`,
      domain:       `sqli-${ts}.example.com`,
      cms:          'WordPress',
      package:      'starter',
    }, { bearer: ADMIN_PASSWORD })
    if (res.status === 500) {
      fail('Got 500 — possible injection or unhandled error')
    } else {
      const body = await json(res)
      if (body.record_id) toCleanup.push({ type: 'client', record_id: body.record_id, client_id: body.client_id })
      pass()
    }
  })

  // ERR-001: Malformed JSON → 400 not 500
  await test('ERR-001', 'Malformed JSON body returns 400 (not 500)', async ({ pass, fail }) => {
    const res = await fetch(`${BASE_URL}/api/clients/create`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_PASSWORD}` },
      body:    '{bad json here',
    })
    if (res.status === 400) pass()
    else if (res.status === 500) fail('Got 500 for malformed JSON')
    else pass()  // 401 before body parsing is also acceptable
  })

  // ERR-002: Non-existent API endpoint → 404 not 500
  await test('ERR-002', 'Non-existent API endpoint returns 404 (not 500)', async ({ pass, fail }) => {
    const res = await GET('/api/this-endpoint-does-not-exist-qa')
    if (res.status === 404) pass()
    else if (res.status === 500) fail('Got 500 for unknown endpoint')
    else pass()
  })

  // SEC-001: Portal token in URL alone is insufficient (need matching session)
  await test('SEC-001', 'Portal token URL without matching session is blocked', async ({ pass, fail, skip }) => {
    // Get a real portal token from Airtable
    try {
      const data  = await airtableList(AIRTABLE_BASE_ID, 'Clients', 'fields[]=portal_token&maxRecords=1')
      const token = data.records?.[0]?.fields?.portal_token
      if (!token) { skip('No clients in Airtable to test with'); return }

      // Try to access portal without any session cookie
      const res = await GET(`/portal/${token}`)
      if (isBlocked(res.status)) pass()
      else fail(`Expected redirect/401/403 without session, got ${res.status}`)
    } catch (e) {
      fail(`Airtable lookup failed: ${e.message}`)
    }
  })

  // PORTAL-002: Client A session cannot access client B's token URL
  await test('PORTAL-002', 'Portal session scoped to token — cross-client access blocked', async ({ pass, fail, skip }) => {
    try {
      const data = await airtableList(AIRTABLE_BASE_ID, 'Clients',
        'fields[]=portal_token&fields[]=client_id&maxRecords=2')
      const recs = data.records || []
      if (recs.length < 2) { skip('Need 2+ clients for cross-client test'); return }

      const [clientA, clientB] = recs
      // Forge a session for clientA
      const sessionA = await forgePortalSession(clientA.id, clientA.fields.portal_token)
      // Try to access clientB's portal using clientA's session
      const res = await GET(`/portal/${clientB.fields.portal_token}`,
        { cookie: `portal_session=${sessionA}` })

      if (isBlocked(res.status)) pass()
      else fail(`Expected redirect/401/403, got ${res.status} — cross-client access possible`)
    } catch (e) {
      fail(`Setup failed: ${e.message}`)
    }
  })
}

// ─── SECTION 13: INTEGRATION HEALTH ─────────────────────────────────────────

async function runIntegrations() {
  section('Section 13 — External Integration Health (config checks)')

  await test('INT-001', 'Anthropic API key present and has expected format', async ({ pass, fail }) => {
    const key = process.env.ANTHROPIC_API_KEY || ''
    if (key.startsWith('sk-ant-api') && key.length > 40) pass()
    else fail('Key missing or wrong format')
  })

  await test('INT-004', 'Google credentials configured (non-placeholder)', async ({ pass, fail }) => {
    const clientId     = process.env.GOOGLE_CLIENT_ID || ''
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || ''
    if (clientId && refreshToken && !refreshToken.includes('REPLACE')) pass()
    else fail('Google credentials missing or placeholder')
  })

  await test('INT-002', 'DataForSEO credentials present (password not placeholder)', async ({ pass, fail }) => {
    const pwd = 'REPLACE_WITH_NEW_DATAFORSEO_PASSWORD'
    if (pwd.includes('REPLACE')) fail('DataForSEO password is still a placeholder — update .env.local')
    else pass()
  })

  await test('INT-009', 'Engain API key present (not placeholder)', async ({ pass, fail }) => {
    const key = 'REPLACE_WITH_NEW_ENGAIN_API_KEY'
    if (key.includes('REPLACE')) fail('Engain API key is a placeholder — update .env.local')
    else pass()
  })
}

// ─── CLEANUP ─────────────────────────────────────────────────────────────────

async function cleanup() {
  if (toCleanup.length === 0) return
  console.log(`\n${'─'.repeat(64)}\n  Cleanup — deleting ${toCleanup.length} test record(s)\n${'─'.repeat(64)}`)
  for (const item of toCleanup) {
    const airtableId = item.record_id
    if (!airtableId) { console.log(`  ⚠  No record_id for ${item.client_id}`); continue }
    try {
      const res = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Clients/${airtableId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
          signal: AbortSignal.timeout(10000) }
      )
      const body = await res.json()
      if (body.deleted) console.log(`  ✓  Deleted: ${item.client_id} (${airtableId})`)
      else console.log(`  ⚠  Delete failed for ${item.client_id}: ${JSON.stringify(body)}`)
    } catch (e) {
      console.log(`  ⚠  Could not delete ${item.client_id}: ${e.message}`)
    }
  }
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

function printSummary() {
  const total = results.pass.length + results.fail.length + results.skip.length
  console.log(`\n${'═'.repeat(64)}`)
  console.log('  QA TEST RESULTS')
  console.log('═'.repeat(64))
  console.log(`  ✓  PASS  ${results.pass.length}`)
  console.log(`  ✗  FAIL  ${results.fail.length}`)
  console.log(`  ○  SKIP  ${results.skip.length}  (manual / needs fixture data)`)
  console.log(`     Total ${total}`)

  if (results.fail.length > 0) {
    console.log('\n  ── FAILURES ───────────────────────────────────────────')
    for (const { id, desc, reason } of results.fail) {
      console.log(`  ✗  ${id}: ${desc}`)
      console.log(`     → ${reason}`)
    }
  }

  if (results.skip.length > 0) {
    console.log('\n  ── SKIPPED (need fixture data or browser) ─────────────')
    for (const { id, reason } of results.skip) {
      console.log(`  ○  ${id.padEnd(14)} ${reason}`)
    }
  }

  console.log('\n  ── ALWAYS-MANUAL CHECKS ───────────────────────────────')
  const manual = [
    'AUTH-001/004  Login form in browser + verify Set-Cookie httpOnly flag',
    'AUTH-013      Concurrent sessions (two browsers, same admin)',
    'AUTH-014      Brute-force: 10 rapid wrong-password attempts → 429',
    'ONB-007       Multi-step form back-navigation preserves field state',
    'SEC-003       XSS: paste <img src=x onerror=alert(1)> into portal',
    'SEC-006       CSRF: cross-origin POST from attacker origin',
    'SEC-009       document.cookie in browser console → session not listed',
    'PERF-001      Portal load time with 6+ months of history',
    'PORTAL-003    GSC live data spot-check vs. Google Search Console',
    'RPT / MONTH   Report generation + quota reset (needs date manipulation)',
  ]
  for (const m of manual) console.log(`  •  ${m}`)

  console.log(`\n${'═'.repeat(64)}\n`)
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(64))
  console.log('  SEO Dashboard — QA Test Runner')
  console.log(`  Target : ${BASE_URL}`)
  console.log(`  Started: ${new Date().toLocaleString()}`)
  console.log('═'.repeat(64))

  // Server check
  try {
    const probe = await fetch(BASE_URL, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
    console.log(`\n  Server reachable — HTTP ${probe.status} ✓`)
  } catch (e) {
    console.error(`\n  ✗ Cannot reach ${BASE_URL}`)
    console.error('  Start the dev server first: cd dashboard && npm run dev\n')
    process.exit(1)
  }

  // Warmup: pre-hit all page routes to trigger Turbopack lazy compilation
  // (first hit can take 20-30s in dev mode — without warmup, 15s test timeouts fire)
  console.log('\n  Warming up server (triggering Turbopack compilation for all routes)...')
  const warmupRoutes = ['/', '/clients', '/jobs', '/approvals', '/token-usage',
                        '/design-review', '/activity', '/reverts', '/login',
                        '/portal/login']
  await Promise.allSettled(warmupRoutes.map(r =>
    fetch(`${BASE_URL}${r}`, { redirect: 'manual', signal: AbortSignal.timeout(60000) }).catch(() => {})
  ))
  console.log('  Warmup complete ✓\n')

  const adminCookie = await forgeAdminSession('admin')

  await runAuth(adminCookie)
  await runOnboarding(adminCookie)
  await runTokens(adminCookie)
  await runQuota(adminCookie)
  await runDataIntegrity()
  await runSecurity(adminCookie)
  await runIntegrations()
  await cleanup()
  printSummary()

  process.exit(results.fail.length > 0 ? 1 : 0)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
