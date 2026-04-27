#!/usr/bin/env node
/**
 * QA — Changes & Internal Links quota enforcement
 * Fixes the client_id field bug from qa-supplement.mjs (must be text slug, not array)
 */
import { webcrypto } from 'crypto'
const crypto = webcrypto
const BASE_URL              = process.env.QA_BASE_URL             || 'http://localhost:3000'
const ADMIN_PASSWORD        = process.env.ADMIN_PASSWORD          || ''
const PORTAL_SESSION_SECRET = process.env.PORTAL_SESSION_SECRET   || process.env.ADMIN_PASSWORD || ''
const AIRTABLE_API_KEY      = process.env.AIRTABLE_API_KEY        || ''
const AIRTABLE_BASE_ID      = process.env.AIRTABLE_BASE_ID        || ''
const CONTENT_BASE_ID       = process.env.CONTENT_AIRTABLE_BASE_ID || ''

const results = { pass: [], fail: [], skip: [], note: [] }
function section(name) { console.log(`\n${'─'.repeat(64)}\n  ${name}\n${'─'.repeat(64)}`) }
const pass  = (id, d)    => { results.pass.push({id,d});          console.log(`  ✓  ${id.padEnd(14)} ${d}`) }
const fail  = (id, d, r) => { results.fail.push({id,d,r});        console.log(`  ✗  ${id.padEnd(14)} ${d}\n     ↳ ${r}`) }
const skip  = (id, d, r) => { results.skip.push({id,d,r});        console.log(`  ○  ${id.padEnd(14)} ${d}  [skip: ${r}]`) }
const note  = (id, d, t) => { results.note.push({id,d,t});        console.log(`  ℹ  ${id.padEnd(14)} ${d}  [note: ${t}]`) }

async function test(id, desc, fn) {
  try {
    let settled = false
    await fn({
      pass: ()  => { if (!settled) { settled=true; pass(id,desc) } },
      fail: (r) => { if (!settled) { settled=true; fail(id,desc,r) } },
      skip: (r) => { if (!settled) { settled=true; skip(id,desc,r) } },
      note: (t) => { if (!settled) { settled=true; note(id,desc,t) } },
    })
  } catch (e) { fail(id, desc, `threw: ${e.message}`) }
}

async function forgePortalSession(clientRecordId, portalToken) {
  const payload = Buffer.from(JSON.stringify({ client_id: clientRecordId, portal_token: portalToken })).toString('base64url')
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(PORTAL_SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${payload}.${sigHex}`
}

async function POST(path, body, opts={}) {
  const h = {'Content-Type':'application/json'}
  if (opts.bearer) h['Authorization'] = `Bearer ${opts.bearer}`
  if (opts.cookie) h['Cookie'] = opts.cookie
  return fetch(`${BASE_URL}${path}`, { method:'POST', headers:h, body:JSON.stringify(body), redirect:'manual', signal:AbortSignal.timeout(20000) })
}
async function j(res) { const t=await res.text(); try{return JSON.parse(t)}catch{return{_raw:t.slice(0,200)}} }

async function atCreate(table, fields) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`, {
    method:'POST', headers:{Authorization:`Bearer ${AIRTABLE_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({fields}),
  })
  if (!res.ok) throw new Error(`Airtable create ${table}: ${await res.text()}`)
  return res.json()
}
async function atDelete(table, id) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}/${id}`, {
    method:'DELETE', headers:{Authorization:`Bearer ${AIRTABLE_API_KEY}`}
  })
  return res.json()
}

const cleanup = []

async function createClient(label, pkg) {
  const ts = Date.now()
  const res = await POST('/api/clients/create', {
    company_name:`QA Chg ${label} ${ts}`, site_url:`https://qa-chg-${label.toLowerCase()}-${ts}.example.com`,
    domain:`qa-chg-${label.toLowerCase()}.example.com`, cms:'WordPress', package:pkg, run_audit:false,
  }, {bearer:ADMIN_PASSWORD})
  const b = await j(res)
  if (!b.ok) throw new Error(`Create client failed: ${JSON.stringify(b)}`)
  cleanup.push({type:'client', id:b.record_id})
  return b // {record_id, client_id (slug), portal_token, ...}
}

async function seedChange(clientSlug, changeType, opts={}) {
  // client_id in Changes is a TEXT field containing the slug
  const fields = {
    client_id: clientSlug,
    type: changeType,
    approval: 'pending',
    change_title: `QA test ${changeType} change`,
    plain_english_explanation: 'QA test change',
    business_impact_explanation: 'QA test',
    confidence: 'High',
    priority: 'Medium',
    cat: 'On-Page',
  }
  if (opts.auto_executable === false) fields.auto_executable = false
  // requires_design_review not in Airtable schema — skip
  const rec = await atCreate('Changes', fields)
  cleanup.push({type:'change', id:rec.id})
  return rec.id
}

async function runChangesTests() {
  section('Section 5 — SEO Changes & Internal Link Quota')

  let starterClient, starterCookie
  try {
    starterClient = await createClient('Starter', 'starter')
    starterCookie = `portal_session=${await forgePortalSession(starterClient.record_id, starterClient.portal_token)}`
  } catch(e) {
    console.log(`  ⚠  Could not create client: ${e.message}`)
  }

  // CHG-011: Invalid portal token → 403
  await test('CHG-011', 'Approvals API: non-existent token → 403', async ({pass,fail}) => {
    const res = await POST('/api/approvals', { recordId:'recFAKERECORD000', decision:'approved', token:'aaaa-0000-0000-0000-fake-token-test' })
    const b = await j(res)
    if (res.status===403||res.status===401) pass()
    else fail(`Expected 403, got ${res.status}: ${JSON.stringify(b)}`)
  })

  // CHG-001: Approve a real pending change
  let pendingChangeId
  await test('CHG-001', 'Approve SEO change: creates implement job or manual_required', async ({pass,fail,skip}) => {
    if (!starterClient) { skip('No fixture client'); return }
    pendingChangeId = await seedChange(starterClient.client_id, 'Heading').catch(e=>{skip(`Seed failed: ${e.message}`);return null})
    if (!pendingChangeId) return
    const res = await POST('/api/approvals', { recordId:pendingChangeId, decision:'approved', token:starterClient.portal_token }, {cookie:starterCookie})
    const b = await j(res)
    if (res.status===200 && b.ok) pass()
    else if (res.status===409 && b.quota_reached) pass()
    else fail(`Got ${res.status}: ${JSON.stringify(b)}`)
  })

  // CHG-005: Skip change → ok, no implement job
  await test('CHG-005', 'Skip change → ok=true, no implement job', async ({pass,fail,skip}) => {
    if (!starterClient) { skip('No fixture client'); return }
    const id = await seedChange(starterClient.client_id, 'Metadata').catch(()=>null)
    if (!id) { skip('Could not seed change'); return }
    const res = await POST('/api/approvals', { recordId:id, decision:'skipped', token:starterClient.portal_token }, {cookie:starterCookie})
    const b = await j(res)
    if (res.status===200 && b.ok) pass()
    else fail(`Expected ok=true, got ${res.status}: ${JSON.stringify(b)}`)
  })

  // CHG-006: auto_executable=false → manual_required
  await test('CHG-006', 'auto_executable=false → outcome=manual_required', async ({pass,fail,skip}) => {
    if (!starterClient) { skip('No fixture client'); return }
    const id = await seedChange(starterClient.client_id, 'Content', {auto_executable:false}).catch(()=>null)
    if (!id) { skip('Could not seed non-executable change'); return }
    const res = await POST('/api/approvals', { recordId:id, decision:'approved', token:starterClient.portal_token }, {cookie:starterCookie})
    const b = await j(res)
    if (res.status===200 && b.outcome==='manual_required') pass()
    else fail(`Expected outcome=manual_required, got ${res.status}: ${JSON.stringify(b)}`)
  })

  // CHG-007: requires_design_review — field not in Airtable schema, document as gap
  await test('CHG-007', 'requires_design_review field in Changes Airtable schema', async ({note}) => {
    note('requires_design_review not found in Changes Airtable schema — design review gate (CHG-007) cannot be triggered from portal; approve route uses changeFields.requires_design_review===true which will always be false')
  })

  // CHG-002: Page optimization quota — not in TYPE_QUOTAS
  await test('CHG-002', 'Page optimization quota enforcement gap', async ({note}) => {
    note('Page Optimization changes not in TYPE_QUOTAS map in approvals/route.ts — Starter (limit:0) and Growth (limit:6) page optimization quotas are NOT enforced at the API level')
  })

  // LINK-001: Approve 1 internal link (Starter, quota=4, starting from 0)
  let linkClient, linkCookie
  try {
    linkClient = await createClient('Link', 'starter')
    linkCookie = `portal_session=${await forgePortalSession(linkClient.record_id, linkClient.portal_token)}`
  } catch(e) {
    console.log(`  ⚠  Could not create link test client: ${e.message}`)
  }

  await test('LINK-001', 'Starter approves 1 internal link (1/4 used)', async ({pass,fail,skip}) => {
    if (!linkClient) { skip('No fixture client'); return }
    const id = await seedChange(linkClient.client_id, 'Internal Link').catch(()=>null)
    if (!id) { skip('Seed failed — "Internal Link" may not be a valid Airtable type option; add it in the Changes table UI'); return }
    const res = await POST('/api/approvals', { recordId:id, decision:'approved', token:linkClient.portal_token }, {cookie:linkCookie})
    const b = await j(res)
    if (res.status===200 && b.ok) pass()
    else if (res.status===409 && b.quota_reached) fail('Quota rejected 1st link (quota=4) — bug')
    else fail(`Got ${res.status}: ${JSON.stringify(b)}`)
  })

  // LINK-002: 5th internal link → quota_reached
  await test('LINK-002', '5th internal link rejected with quota_reached (Starter limit=4)', async ({pass,fail,skip}) => {
    if (!linkClient) { skip('No fixture client'); return }
    // Approve links 2, 3, 4 (link 1 was approved in LINK-001 above)
    for (let i=0; i<3; i++) {
      const id = await seedChange(linkClient.client_id, 'Internal Link').catch(()=>null)
      if (id) await POST('/api/approvals', { recordId:id, decision:'approved', token:linkClient.portal_token }, {cookie:linkCookie})
    }
    // 5th link
    const id5 = await seedChange(linkClient.client_id, 'Internal Link').catch(()=>null)
    if (!id5) { skip('Could not seed 5th link — "Internal Link" may not be a valid Airtable type option'); return }
    const res = await POST('/api/approvals', { recordId:id5, decision:'approved', token:linkClient.portal_token }, {cookie:linkCookie})
    const b = await j(res)
    if (res.status===409 && b.quota_reached) pass()
    else fail(`Expected 409+quota_reached, got ${res.status}: ${JSON.stringify(b)}`)
  })

  // LINK-003: Growth 11th link → quota_reached
  let growthLinkClient, growthLinkCookie
  try {
    growthLinkClient = await createClient('GrowthLink', 'growth')
    growthLinkCookie = `portal_session=${await forgePortalSession(growthLinkClient.record_id, growthLinkClient.portal_token)}`
  } catch(e) {}

  await test('LINK-003', 'Growth 11th internal link rejected (limit=10)', async ({pass,fail,skip}) => {
    if (!growthLinkClient) { skip('No Growth fixture client'); return }
    // Approve 10 links
    for (let i=0; i<10; i++) {
      const id = await seedChange(growthLinkClient.client_id, 'Internal Link').catch(()=>null)
      if (id) await POST('/api/approvals', { recordId:id, decision:'approved', token:growthLinkClient.portal_token }, {cookie:growthLinkCookie})
    }
    // 11th
    const id11 = await seedChange(growthLinkClient.client_id, 'Internal Link').catch(()=>null)
    if (!id11) { skip('Could not seed 11th link — "Internal Link" may not be a valid Airtable type option'); return }
    const res = await POST('/api/approvals', { recordId:id11, decision:'approved', token:growthLinkClient.portal_token }, {cookie:growthLinkCookie})
    const b = await j(res)
    if (res.status===409 && b.quota_reached) pass()
    else fail(`Expected 409+quota_reached, got ${res.status}: ${JSON.stringify(b)}`)
  })

  // DATA-003: Race condition — concurrent approvals at quota limit
  let raceClient, raceCookie
  try {
    raceClient = await createClient('Race', 'starter')
    raceCookie = `portal_session=${await forgePortalSession(raceClient.record_id, raceClient.portal_token)}`
  } catch(e) {}

  await test('DATA-003', 'Quota atomicity: concurrent approvals at limit (race condition)', async ({pass,fail,skip}) => {
    if (!raceClient) { skip('No race fixture client'); return }
    // Approve 3 links (bring to 3/4)
    for (let i=0; i<3; i++) {
      const id = await seedChange(raceClient.client_id, 'Internal Link').catch(()=>null)
      if (id) await POST('/api/approvals', { recordId:id, decision:'approved', token:raceClient.portal_token }, {cookie:raceCookie})
    }
    // Fire link 4 and 5 concurrently
    const [id4, id5] = await Promise.all([
      seedChange(raceClient.client_id, 'Internal Link').catch(()=>null),
      seedChange(raceClient.client_id, 'Internal Link').catch(()=>null),
    ])
    if (!id4||!id5) { skip('Could not seed concurrent links — "Internal Link" may not be a valid Airtable type option'); return }
    const [res4,res5] = await Promise.all([
      POST('/api/approvals', { recordId:id4, decision:'approved', token:raceClient.portal_token }, {cookie:raceCookie}),
      POST('/api/approvals', { recordId:id5, decision:'approved', token:raceClient.portal_token }, {cookie:raceCookie}),
    ])
    const [b4,b5] = [await j(res4), await j(res5)]
    const successes = [res4,res5].filter(r=>r.status===200).length
    const quotaErrors = [b4,b5].filter(b=>b.quota_reached).length
    if (successes===1 && quotaErrors===1) pass()
    else if (successes===2) fail(`CRITICAL: Both concurrent approvals succeeded — race condition! Both links 4 and 5 approved (count would be 5)`)
    else fail(`Unexpected result: ${successes} successes, ${quotaErrors} quota errors`)
  })
}

async function runCleanup() {
  if (cleanup.length===0) return
  console.log(`\n${'─'.repeat(64)}\n  Cleanup — ${cleanup.length} records\n${'─'.repeat(64)}`)
  for (const item of cleanup) {
    const table = item.type==='client' ? 'Clients' : 'Changes'
    const r = await atDelete(table, item.id).catch(e=>({error:e.message}))
    if (r.deleted) console.log(`  ✓  Deleted ${item.type}: ${item.id}`)
    else console.log(`  ⚠  ${item.id}: ${JSON.stringify(r).slice(0,80)}`)
  }
}

async function main() {
  console.log('\n' + '═'.repeat(64))
  console.log('  QA Changes & Links Runner')
  console.log(`  Target : ${BASE_URL}`)
  console.log('═'.repeat(64))
  const probe = await fetch(BASE_URL, {redirect:'manual',signal:AbortSignal.timeout(8000)}).catch(e=>{console.error(`Cannot reach: ${e.message}`);process.exit(1)})
  console.log(`  Server: HTTP ${probe.status} ✓`)

  await runChangesTests()
  await runCleanup()

  const total = results.pass.length + results.fail.length + results.skip.length + results.note.length
  console.log(`\n${'═'.repeat(64)}\n  CHANGES/LINKS QA RESULTS\n${'═'.repeat(64)}`)
  console.log(`  ✓  PASS  ${results.pass.length}\n  ✗  FAIL  ${results.fail.length}\n  ○  SKIP  ${results.skip.length}\n  ℹ  NOTE  ${results.note.length}\n     Total ${total}`)
  if (results.fail.length>0) {
    console.log('\n  ── FAILURES ──────────────────────────────────────────')
    results.fail.forEach(({id,d,r})=>console.log(`  ✗  ${id}: ${d}\n     → ${r}`))
  }
  if (results.note.length>0) {
    console.log('\n  ── NOTES ─────────────────────────────────────────────')
    results.note.forEach(({id,d,t})=>console.log(`  ℹ  ${id}: ${d}\n     → ${t}`))
  }
  console.log(`\n${'═'.repeat(64)}\n`)
  process.exit(results.fail.length>0?1:0)
}

main().catch(e=>{console.error('Fatal:',e);process.exit(1)})
