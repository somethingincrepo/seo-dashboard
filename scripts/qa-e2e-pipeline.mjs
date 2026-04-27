#!/usr/bin/env node
/**
 * qa-e2e-pipeline.mjs — End-to-End Autonomous Pipeline Tests
 *
 * Tests the live async pipeline that paying clients depend on — not just API
 * responses, but whether background workers actually do their jobs.
 *
 *   E2E-001  Intake form → audit_parent job queued in Supabase within 8s
 *   E2E-002  Audit job claimed by Fly.io worker within 60s
 *   E2E-003  Audit job completes with result populated (timeout: 5 min)
 *   E2E-004  Airtable client record exists with correct plan_status after intake
 *   E2E-005  Title approval → Content Job set to Queued in Airtable (n8n fired)
 *   E2E-006  Portal quota response matches Starter plan entitlements (8/0/1)
 *   E2E-007  Report schedule endpoint creates report_generate jobs in Supabase
 *   E2E-008  Quota actuals never exceed package limits (billing integrity)
 *   E2E-009  Completed job has cost_usd > 0 and model field set
 *   E2E-010  Cron dispatch accepts admin bearer auth and returns valid shape
 *
 * Usage:
 *   node scripts/qa-e2e-pipeline.mjs                         # all tests
 *   QA_E2E_TESTS=intake,content node scripts/qa-e2e-pipeline.mjs
 *   QA_E2E_TESTS=e2e-001,e2e-005 node scripts/qa-e2e-pipeline.mjs
 *
 * Required env vars:
 *   QA_BASE_URL (default: http://localhost:3000)
 *   ADMIN_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   AIRTABLE_API_KEY, AIRTABLE_BASE_ID
 *   CONTENT_AIRTABLE_BASE_ID
 *
 * Optional (E2E-005/006/008 skip without these):
 *   QA_FIXTURE_STARTER_CLIENT_ID    Airtable record ID of a Starter client
 *   QA_FIXTURE_PORTAL_TOKEN_STARTER Portal UUID for that Starter client
 */

import { webcrypto } from 'crypto'
import { performance } from 'perf_hooks'

const crypto = webcrypto

// ── CONFIG ────────────────────────────────────────────────────────────────────

const BASE_URL              = process.env.QA_BASE_URL               || 'http://localhost:3000'
const ADMIN_PASSWORD        = process.env.ADMIN_PASSWORD            || ''
const PORTAL_SESSION_SECRET = process.env.PORTAL_SESSION_SECRET     || ADMIN_PASSWORD
const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL  || process.env.SUPABASE_URL || ''
const SUPABASE_KEY          = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const AIRTABLE_API_KEY      = process.env.AIRTABLE_API_KEY          || ''
const AIRTABLE_BASE_ID      = process.env.AIRTABLE_BASE_ID          || ''
const CONTENT_BASE_ID       = process.env.CONTENT_AIRTABLE_BASE_ID  || ''

const FIX_STARTER_ID        = process.env.QA_FIXTURE_STARTER_CLIENT_ID    || ''
const FIX_PORTAL_STARTER    = process.env.QA_FIXTURE_PORTAL_TOKEN_STARTER  || ''

const JOB_CLAIM_TIMEOUT_MS    = 60_000    // 60s for Fly.io to claim
const JOB_COMPLETE_TIMEOUT_MS = 300_000   // 5 min to complete
const AIRTABLE_POLL_MS        = 15_000    // 15s for Airtable to reflect a write

const TESTS_ARG = (process.env.QA_E2E_TESTS || 'all').toLowerCase()
const RUN_ALL   = TESTS_ARG === 'all'
const activeSet = new Set(TESTS_ARG.split(',').map(s => s.trim()))
const run       = (name) => RUN_ALL || activeSet.has(name.toLowerCase())

// ── TEST FRAMEWORK ────────────────────────────────────────────────────────────

const results = { pass: [], fail: [], skip: [] }

function _pass(id, msg)         { results.pass.push({ id, msg }); console.log(`  ✓  ${id.padEnd(10)} ${msg}`) }
function _fail(id, msg, reason) { results.fail.push({ id, msg, reason }); console.log(`  ✗  ${id.padEnd(10)} ${msg}\n     ↳ ${reason}`) }
function _skip(id, msg, reason) { results.skip.push({ id, msg, reason }); console.log(`  ○  ${id.padEnd(10)} ${msg}  [skip: ${reason}]`) }

async function test(id, desc, fn) {
  const t0 = performance.now()
  try {
    const result = await fn()
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1)
    const label = `${desc}  (${elapsed}s)`
    if (result.skipped)    _skip(id, desc, result.reason)
    else if (result.ok)    _pass(id, label)
    else                   _fail(id, desc, result.reason ?? 'unknown failure')
  } catch (e) {
    _fail(id, desc, `threw: ${e.message}`)
  }
}

// ── SESSION FACTORIES (mirrors lib/auth.ts + lib/portal-auth.ts) ─────────────

async function forgeAdminSession(username = 'admin', offsetSecs = 604800) {
  const exp     = Math.floor(Date.now() / 1000) + offsetSecs
  const payload = `${encodeURIComponent(username)}.${exp}`
  const enc     = new TextEncoder()
  const key     = await crypto.subtle.importKey(
    'raw', enc.encode(ADMIN_PASSWORD),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig    = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const bytes  = new Uint8Array(sig)
  let   str    = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  const b64url = Buffer.from(str, 'binary').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${payload}.${b64url}`
}

async function forgePortalSession(clientId, portalToken) {
  const payload = Buffer
    .from(JSON.stringify({ client_id: clientId, portal_token: portalToken }))
    .toString('base64url')
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(PORTAL_SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${payload}.${sigHex}`
}

// ── HTTP HELPERS ──────────────────────────────────────────────────────────────

function buildHeaders(opts = {}) {
  const h = {}
  if (opts.cookie) h['Cookie']        = opts.cookie
  if (opts.bearer) h['Authorization'] = `Bearer ${opts.bearer}`
  return h
}

async function GET(path, opts = {}) {
  return fetch(`${BASE_URL}${path}`, {
    headers: buildHeaders(opts), redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
}

async function POST(path, body, opts = {}) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildHeaders(opts) },
    body: JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
}

async function PATCH(path, body, opts = {}) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...buildHeaders(opts) },
    body: JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
}

async function DELETE_REQ(path, body, opts = {}) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...buildHeaders(opts) },
    body: JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
}

async function readJSON(res) {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { _raw: text } }
}

// ── SUPABASE HELPERS ──────────────────────────────────────────────────────────

async function supabaseQuery(table, qs) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: {
      apikey:        SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept:        'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Supabase query failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supabaseInsert(table, record) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: {
      apikey:         SUPABASE_KEY,
      Authorization:  `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=representation',
    },
    body: JSON.stringify(record),
    signal: AbortSignal.timeout(10_000),
  })
  return res.json()
}

async function supabaseDelete(table, col, val) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(val)}`, {
    method:  'DELETE',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    signal: AbortSignal.timeout(10_000),
  })
}

// ── AIRTABLE HELPERS ──────────────────────────────────────────────────────────

async function airtableFetch(base, table, params = {}) {
  const qs = new URLSearchParams()
  if (params.filterByFormula) qs.set('filterByFormula', params.filterByFormula)
  if (params.maxRecords)      qs.set('maxRecords', String(params.maxRecords))
  const res = await fetch(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}?${qs}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    signal:  AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Airtable ${table} fetch failed ${res.status}: ${body}`)
  }
  const data = await res.json()
  return data.records ?? []
}

// ── POLLING ───────────────────────────────────────────────────────────────────

async function pollUntil(fn, timeoutMs, startIntervalMs = 2000) {
  const deadline = Date.now() + timeoutMs
  let delay = startIntervalMs
  while (Date.now() < deadline) {
    const result = await fn()
    if (result !== null) return result
    const wait = Math.min(delay, deadline - Date.now())
    if (wait <= 0) break
    await new Promise(r => setTimeout(r, wait))
    delay = Math.min(delay * 1.5, 15_000)
  }
  return null
}

// ── SHARED STATE ──────────────────────────────────────────────────────────────

let _testClientRecordId = null  // Airtable record ID from intake
let _testClientId       = null  // client_id slug from intake
let _auditJobId         = null  // Supabase job ID for audit_parent
let _auditJob           = null  // Final completed job (used in E2E-009)
let _contentJobId       = null  // Airtable record ID of test content job

// ── CLEANUP ───────────────────────────────────────────────────────────────────

async function cleanup() {
  const adminSession = ADMIN_PASSWORD ? await forgeAdminSession() : null

  if (_contentJobId && adminSession) {
    try {
      await DELETE_REQ(
        `/api/portal/titles?token=${FIX_PORTAL_STARTER}`,
        { record_id: _contentJobId },
        { cookie: `portal_session=${await forgePortalSession(FIX_STARTER_ID, FIX_PORTAL_STARTER)}` }
      )
    } catch { /* non-fatal */ }
  }

  if (_testClientRecordId && adminSession) {
    console.log(`\n  Cleaning up test client (${_testClientRecordId})...`)
    try {
      const res = await POST(
        `/api/clients/${_testClientRecordId}/delete`,
        {},
        { cookie: `admin_session=${adminSession}` }
      )
      if (res.ok) console.log('  ✓  Test client deleted')
      else        console.log(`  ✗  Client delete returned ${res.status}`)
    } catch (e) {
      console.log(`  ✗  Cleanup threw: ${e.message}`)
    }
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  qa-e2e-pipeline — Autonomous Pipeline Tests')
  console.log(`  Target:   ${BASE_URL}`)
  console.log(`  Fixtures: starter=${FIX_STARTER_ID ? '✓' : '✗'}`)
  console.log(`  Tests:    ${TESTS_ARG}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // ── AUDIT PIPELINE ──────────────────────────────────────────────────────────

  if (run('intake') || run('e2e-001')) {
    await test('E2E-001', 'Intake form → audit_parent job queued in Supabase', async () => {
      if (!ADMIN_PASSWORD)             return { ok: false, reason: 'ADMIN_PASSWORD not set' }
      if (!SUPABASE_URL || !SUPABASE_KEY) return { ok: false, reason: 'Supabase env vars not set' }
      if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return { ok: false, reason: 'Airtable env vars not set' }

      const adminCookie = `admin_session=${await forgeAdminSession()}`

      // Generate a fresh invite token so we don't burn a real one
      const tokenRes = await POST(
        '/api/tokens/generate',
        { package_tier: 'starter', notes: 'qa-e2e-pipeline auto-test' },
        { cookie: adminCookie }
      )
      if (tokenRes.status !== 201) {
        const b = await readJSON(tokenRes)
        return { ok: false, reason: `Token generate returned ${tokenRes.status}: ${JSON.stringify(b)}` }
      }
      const tokenData  = await readJSON(tokenRes)
      const inviteToken = tokenData.token?.token
      if (!inviteToken) return { ok: false, reason: `No token string in response: ${JSON.stringify(tokenData)}` }

      // Submit the intake form with minimal required fields
      const tag       = Date.now()
      const intakeRes = await POST('/api/intake', {
        company_name:  `QA E2E Test ${tag}`,
        contact_name:  'QA Bot',
        contact_email: `qa+${tag}@test.example.com`,
        site_url:      `https://qa-e2e-${tag}.example.com`,
        cms:           'WordPress',
        keywords:      'qa test keyword one, qa test keyword two',
        competitors:   'competitor-a.example.com',
        invite_token:  inviteToken,
      })

      if (intakeRes.status !== 201) {
        const b = await readJSON(intakeRes)
        return { ok: false, reason: `Intake returned ${intakeRes.status}: ${JSON.stringify(b)}` }
      }
      const intakeData    = await readJSON(intakeRes)
      _testClientRecordId = intakeData.record_id
      _testClientId       = intakeData.client_id

      if (!_testClientRecordId) return { ok: false, reason: 'Intake response missing record_id' }

      // Poll Supabase for the audit_parent job (inserted non-blocking after intake returns)
      const job = await pollUntil(async () => {
        const rows = await supabaseQuery('jobs',
          `select=id,status,runner,sop_name&client_id=eq.${_testClientRecordId}&sop_name=eq.audit_parent&order=created_at.desc&limit=1`
        )
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
      }, 8_000, 1_000)

      if (!job) return { ok: false, reason: `No audit_parent job in Supabase for ${_testClientRecordId} within 8s` }
      _auditJobId = job.id

      if (job.runner !== 'fly')
        return { ok: false, reason: `Expected runner=fly, got runner=${job.runner}` }

      return { ok: true }
    })
  }

  if (run('claim') || run('e2e-002')) {
    await test('E2E-002', 'Fly.io worker claims audit job within 60s', async () => {
      if (!_auditJobId) return { skipped: true, reason: 'E2E-001 did not produce a job ID' }

      const job = await pollUntil(async () => {
        const rows = await supabaseQuery('jobs', `select=id,status&id=eq.${_auditJobId}`)
        const j = Array.isArray(rows) ? rows[0] : null
        if (j && j.status !== 'pending') return j
        return null
      }, JOB_CLAIM_TIMEOUT_MS, 3_000)

      if (!job)
        return { ok: false, reason: `Job still pending after ${JOB_CLAIM_TIMEOUT_MS / 1000}s — Fly.io worker may be down or cold` }

      return { ok: true }
    })
  }

  if (run('complete') || run('e2e-003')) {
    await test('E2E-003', 'Audit job completes (status=done) within 5 min', async () => {
      if (!_auditJobId) return { skipped: true, reason: 'E2E-001 did not produce a job ID' }

      const job = await pollUntil(async () => {
        const rows = await supabaseQuery('jobs', `select=*&id=eq.${_auditJobId}`)
        const j = Array.isArray(rows) ? rows[0] : null
        if (j && (j.status === 'done' || j.status === 'failed')) return j
        return null
      }, JOB_COMPLETE_TIMEOUT_MS, 5_000)

      if (!job) return { ok: false, reason: `Job did not complete within ${JOB_COMPLETE_TIMEOUT_MS / 1000}s` }
      if (job.status === 'failed') return { ok: false, reason: `Job failed: ${job.error ?? '(no error message)'}` }
      if (!job.finished_at) return { ok: false, reason: 'status=done but finished_at is null' }

      _auditJob = job
      return { ok: true }
    })
  }

  if (run('airtable') || run('e2e-004')) {
    await test('E2E-004', 'Airtable client record has correct plan_status after intake', async () => {
      if (!_testClientRecordId) return { skipped: true, reason: 'E2E-001 did not create a client' }
      if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return { ok: false, reason: 'Airtable env vars not set' }

      const records = await airtableFetch(AIRTABLE_BASE_ID, 'Clients', {
        filterByFormula: `RECORD_ID()="${_testClientRecordId}"`,
        maxRecords: 1,
      })

      if (!records[0]) return { ok: false, reason: `Client ${_testClientRecordId} not found in Airtable` }
      const f = records[0].fields

      if (!f.company_name)  return { ok: false, reason: 'company_name field missing' }
      if (!f.plan_status)   return { ok: false, reason: 'plan_status field missing' }
      if (f.plan_status !== 'month1_audit')
        return { ok: false, reason: `Expected plan_status=month1_audit, got ${f.plan_status}` }
      if (!f.portal_token)  return { ok: false, reason: 'portal_token not set on client record' }

      return { ok: true }
    })
  }

  // ── CONTENT GENERATION PIPELINE ────────────────────────────────────────────

  if (run('content') || run('e2e-005')) {
    await test('E2E-005', 'Title approval → Content Job Status=Queued in Airtable (n8n triggered)', async () => {
      if (!FIX_STARTER_ID || !FIX_PORTAL_STARTER)
        return { skipped: true, reason: 'Set QA_FIXTURE_STARTER_CLIENT_ID + QA_FIXTURE_PORTAL_TOKEN_STARTER' }
      if (!CONTENT_BASE_ID) return { ok: false, reason: 'CONTENT_AIRTABLE_BASE_ID not set' }

      const portalCookie = `portal_session=${await forgePortalSession(FIX_STARTER_ID, FIX_PORTAL_STARTER)}`
      const tokenQS      = `?token=${FIX_PORTAL_STARTER}`

      // Create a test title in the Content Jobs table via the portal API
      const createRes = await POST(`/api/portal/titles${tokenQS}`, {
        title:             `QA E2E Test Title ${Date.now()}`,
        target_keyword:    'qa automated test keyword',
        search_intent:     'informational',
        content_type_name: 'standard',
      }, { cookie: portalCookie })

      if (!createRes.ok) {
        const b = await readJSON(createRes)
        return { ok: false, reason: `Title create failed ${createRes.status}: ${JSON.stringify(b)}` }
      }
      const createData = await readJSON(createRes)
      _contentJobId    = createData.id

      if (!_contentJobId) return { ok: false, reason: 'No record_id in title create response' }

      // Approve the title (triggers Airtable update to Status=Queued + fires n8n webhook)
      const approveRes  = await PATCH(`/api/portal/titles${tokenQS}`, {
        record_id:         _contentJobId,
        action:            'approve',
        content_type_name: 'standard',
      }, { cookie: portalCookie })

      const approveData = await readJSON(approveRes)

      // quota_reached → next_month scheduling is correct behavior, not a failure
      if (approveData.next_month) {
        console.log(`       ↳ Quota full — scheduled for next month (expected for a fixture at limit)`)
        return { ok: true }
      }

      if (!approveRes.ok)
        return { ok: false, reason: `Title approve returned ${approveRes.status}: ${JSON.stringify(approveData)}` }

      // Poll Airtable until the Content Job record reflects Status=Queued
      const queued = await pollUntil(async () => {
        const recs = await airtableFetch(CONTENT_BASE_ID, 'Content Jobs', {
          filterByFormula: `RECORD_ID()="${_contentJobId}"`,
          maxRecords: 1,
        })
        const r = recs[0]
        if (!r) return null
        if (r.fields.Status === 'Queued' || r.fields.Status === 'Webhook Failed') return r
        return null
      }, AIRTABLE_POLL_MS, 2_000)

      if (!queued)
        return { ok: false, reason: `Content Job ${_contentJobId} did not reach Queued within ${AIRTABLE_POLL_MS / 1000}s` }

      if (queued.fields.Status === 'Webhook Failed')
        return { ok: false, reason: 'n8n webhook failed — content generation trigger is broken (check N8N_CONTENT_WEBHOOK_URL)' }

      return { ok: true }
    })
  }

  if (run('quota') || run('e2e-006')) {
    await test('E2E-006', 'Portal quota response matches Starter plan entitlements (8 std / 0 long / 1 refresh)', async () => {
      if (!FIX_STARTER_ID || !FIX_PORTAL_STARTER)
        return { skipped: true, reason: 'Set QA_FIXTURE_STARTER_CLIENT_ID + QA_FIXTURE_PORTAL_TOKEN_STARTER' }

      const portalCookie = `portal_session=${await forgePortalSession(FIX_STARTER_ID, FIX_PORTAL_STARTER)}`
      const res = await GET(`/api/portal/titles?token=${FIX_PORTAL_STARTER}`, { cookie: portalCookie })

      if (!res.ok) return { ok: false, reason: `GET /api/portal/titles returned ${res.status}` }

      const data  = await readJSON(res)
      const quota = data.quota
      const pkg   = data.package

      if (!quota) return { ok: false, reason: `No quota field in response: ${JSON.stringify(data)}` }

      if (pkg === 'starter') {
        if (quota.standard?.limit !== 8)
          return { ok: false, reason: `standard.limit should be 8, got ${quota.standard?.limit}` }
        if (quota.longform?.limit !== 0)
          return { ok: false, reason: `longform.limit should be 0, got ${quota.longform?.limit}` }
        if (quota.refresh?.limit !== 1)
          return { ok: false, reason: `refresh.limit should be 1, got ${quota.refresh?.limit}` }
      } else {
        // Non-starter fixture: just verify quota shape is complete
        if (!quota.standard || !quota.refresh)
          return { ok: false, reason: `Quota missing expected fields — got: ${JSON.stringify(quota)}` }
        console.log(`       ↳ Fixture is ${pkg} plan — quota shape verified (limits not checked for non-starter)`)
      }

      return { ok: true }
    })
  }

  // ── REPORTS & SCHEDULING ────────────────────────────────────────────────────

  if (run('reports') || run('e2e-007')) {
    await test('E2E-007', 'Report schedule endpoint creates report_generate jobs in Supabase', async () => {
      if (!ADMIN_PASSWORD) return { ok: false, reason: 'ADMIN_PASSWORD not set' }
      if (!SUPABASE_URL || !SUPABASE_KEY) return { ok: false, reason: 'Supabase env vars not set' }

      // Use day=1 — tests the mechanism regardless of whether any client has report_day=1
      const res = await POST('/api/reports/schedule', { day: 1 }, { bearer: ADMIN_PASSWORD })

      if (res.status === 401) return { ok: false, reason: 'Admin bearer auth rejected — ADMIN_PASSWORD mismatch' }
      if (!res.ok)            return { ok: false, reason: `Schedule returned ${res.status}` }

      const data = await readJSON(res)
      if (typeof data.scheduled !== 'number') return { ok: false, reason: `Response missing "scheduled" number: ${JSON.stringify(data)}` }
      if (typeof data.day !== 'number')       return { ok: false, reason: 'Response missing "day" field' }

      // If clients were due, verify their jobs landed in Supabase
      if (data.scheduled > 0 && Array.isArray(data.clients) && data.clients.length > 0) {
        const jobId = data.clients[0].job_id
        if (!jobId) return { ok: false, reason: 'Scheduled client has no job_id in response' }

        const rows = await supabaseQuery('jobs', `select=id,sop_name,status&id=eq.${jobId}`)
        if (!Array.isArray(rows) || rows.length === 0)
          return { ok: false, reason: `Job ${jobId} returned by schedule but not found in Supabase` }
        if (rows[0].sop_name !== 'report_generate')
          return { ok: false, reason: `Expected sop_name=report_generate, got ${rows[0].sop_name}` }

        console.log(`       ↳ Scheduled ${data.scheduled} report(s) for day ${data.day}`)
      } else {
        console.log(`       ↳ No clients have report_day=1 — endpoint works, just nothing due`)
      }

      return { ok: true }
    })
  }

  // ── BILLING INTEGRITY ───────────────────────────────────────────────────────

  if (run('actuals') || run('e2e-008')) {
    await test('E2E-008', 'Quota actuals never exceed package limits (no billing leakage)', async () => {
      if (!FIX_STARTER_ID || !FIX_PORTAL_STARTER)
        return { skipped: true, reason: 'Set QA_FIXTURE_STARTER_CLIENT_ID + QA_FIXTURE_PORTAL_TOKEN_STARTER' }

      const portalCookie = `portal_session=${await forgePortalSession(FIX_STARTER_ID, FIX_PORTAL_STARTER)}`
      const res = await GET(`/api/portal/titles?token=${FIX_PORTAL_STARTER}`, { cookie: portalCookie })

      if (!res.ok) return { ok: false, reason: `GET /api/portal/titles returned ${res.status}` }
      const data  = await readJSON(res)
      const quota = data.quota

      if (!quota) return { ok: false, reason: 'No quota in response' }

      const violations = []
      for (const [type, q] of Object.entries(quota)) {
        if (typeof q.used === 'number' && typeof q.limit === 'number' && q.used > q.limit) {
          violations.push(`${type}: used=${q.used} > limit=${q.limit}`)
        }
      }

      if (violations.length > 0)
        return { ok: false, reason: `Quota exceeded (BILLING LEAK): ${violations.join(', ')}` }

      return { ok: true }
    })
  }

  // ── JOB COST TRACKING ───────────────────────────────────────────────────────

  if (run('cost') || run('e2e-009')) {
    await test('E2E-009', 'Completed job has cost_usd > 0 and model field set', async () => {
      if (!SUPABASE_URL || !SUPABASE_KEY) return { ok: false, reason: 'Supabase env vars not set' }

      // Prefer the audit job we just ran
      if (_auditJob) {
        if (_auditJob.status !== 'done')
          return { ok: false, reason: `Audit job is ${_auditJob.status}, cannot check cost` }
        if (!(_auditJob.cost_usd > 0))
          return { ok: false, reason: `cost_usd is ${_auditJob.cost_usd} — token usage not being tracked` }
        if (!_auditJob.model)
          return { ok: false, reason: 'model field is null on completed job' }
        return { ok: true }
      }

      // Fallback: scan recent completed jobs in Supabase
      const rows = await supabaseQuery('jobs',
        `select=id,sop_name,cost_usd,model,status&status=eq.done&order=finished_at.desc&limit=10`
      )
      if (!Array.isArray(rows) || rows.length === 0)
        return { skipped: true, reason: 'No completed jobs in Supabase to verify (run E2E-001..003 first, or run jobs manually)' }

      const good = rows.filter(j => j.cost_usd > 0 && j.model)
      if (good.length === 0)
        return { ok: false, reason: `${rows.length} completed jobs found but none have cost_usd > 0 and model set` }

      console.log(`       ↳ ${good.length}/${rows.length} recent jobs have cost + model tracked`)
      return { ok: true }
    })
  }

  // ── CRON DISPATCH ───────────────────────────────────────────────────────────

  if (run('cron') || run('e2e-010')) {
    await test('E2E-010', 'Cron dispatch accepts admin bearer auth and returns valid shape', async () => {
      if (!ADMIN_PASSWORD) return { ok: false, reason: 'ADMIN_PASSWORD not set' }

      // Verify auth and response shape (dispatched=0 is fine — no vercel-runner jobs pending)
      const res = await GET('/api/cron/dispatch', { bearer: ADMIN_PASSWORD })

      if (res.status === 401) return { ok: false, reason: 'Admin bearer auth rejected — ADMIN_PASSWORD mismatch' }
      if (!res.ok)            return { ok: false, reason: `Cron dispatch returned ${res.status}` }

      const data = await readJSON(res)
      if (typeof data.dispatched !== 'number')
        return { ok: false, reason: `Response missing "dispatched" field: ${JSON.stringify(data)}` }

      if (data.dispatched > 0) console.log(`       ↳ Dispatched ${data.dispatched} vercel job(s) during this run`)

      return { ok: true }
    })
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────

  await cleanup()

  const { pass, fail, skip } = results
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  ${pass.length} pass  |  ${fail.length} fail  |  ${skip.length} skip`)

  if (fail.length > 0) {
    console.log('\n  Failures:')
    fail.forEach(f => console.log(`    ${f.id.padEnd(10)} ${f.msg ?? ''}\n    ↳ ${f.reason}`))
  }

  if (skip.length > 0) {
    console.log('\n  Skipped (set fixture env vars to enable):')
    skip.forEach(s => console.log(`    ${s.id.padEnd(10)} ${s.reason}`))
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  process.exit(fail.length > 0 ? 1 : 0)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
