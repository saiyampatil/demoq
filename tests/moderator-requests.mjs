// Moderator view, Requests tab: escalations nobody took live, each with the participant's suggested time.
//   a live escalation that times out becomes a request; Schedule at this time books the slot and moves it to Upcoming;
//   scheduling is blocked when the moderator isn't free or the time has passed; an edited time waits for the participant,
//   schedules on Accept and returns to Open on Decline; a taken request can't be booked by a second moderator;
//   counts always match the list. Every step waits on state and every expectation is asserted.
//   npx vite --port 5199 --strictPort &   then   node tests/moderator-requests.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const researcher = '/researcher/studies/moisturizer-concept'
const SID = 'P-2042-1' // Active in the "Live in fieldwork" seed, so it can ask
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const text = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const count = (sel) => b.evaluate(`document.querySelectorAll(${JSON.stringify(sel)}).length`)
const clickTid = async (tid) => {
  const done = await b.poll(`(()=>{const e=document.querySelector('[data-testid=${tid}]');if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for [data-testid=${tid}]`)
  await b.sleep(400)
}
// Modules are imported by the exact URL the app loaded (the dev server adds ?t= after an edit), so they are the app's own instances.
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
const stage = async () => {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`)
}
// What stands in for the participant and the live moderators lives in the Screen jump panel, so open it, act, close it.
const sim = async (tid) => {
  await b.evaluate(`document.querySelector('[role=dialog]') || __click('Screen jump'); true`); await b.sleep(250)
  await clickTid(tid)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`); await b.sleep(250)
}
const r19 = async (sid = SID) => { await b.goto(`${researcher}/fieldwork/sessions/${sid}`); await b.waitFor('Technical issues'); await b.sleep(600) }
const viewAs = async (id) => { await b.evaluate(`(()=>{const s=document.querySelector('[data-testid=view-as]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(id)});s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); await b.sleep(400) }
const mod = async (tab = 'requests') => { await b.goto(`/moderator/sessions?tab=${tab}`); await b.waitFor('My sessions'); await b.sleep(600) }
const filter = async (f) => { await clickTid(`rq-filter-${f}`) }
const rows = () => b.evaluate(`[...document.querySelectorAll('[data-testid=request-row]')].map(r=>({key:r.dataset.key,p:r.dataset.participant,status:r.dataset.status,suggested:r.dataset.suggested,text:r.innerText.replace(/\\s+/g,' '),buttons:[...r.querySelectorAll('button')].map(x=>({t:x.innerText.trim(),d:x.disabled}))}))`)
const rowOf = async (p) => (await rows()).find((r) => r.p === p)
/** The tab's number and every filter's number are the lengths of the lists they stand for. */
const countsMatch = async (label) => {
  const badge = Number(await text('[data-testid=mcount-requests]'))
  const per = {}
  for (const f of ['Open', 'Scheduled', 'Closed']) {
    const shown = Number((await text(`[data-testid=rq-filter-${f}]`)).match(/(\d+)$/)?.[1])
    await filter(f)
    per[f] = { shown, listed: await count('[data-testid=request-row]') }
  }
  await filter('Open')
  ok(`${label}: the tab's number is the Open list`, badge === per.Open.listed, { badge, per })
  ok(`${label}: every filter's number is its list`, Object.values(per).every((x) => x.shown === x.listed), per)
}
/** Edit the saved app state in place, then reload so the app reads it. */
const mutate = async (fnSrc) => {
  await b.evaluate(`(()=>{const k='pulseai-qual:v2';const s=JSON.parse(localStorage.getItem(k));(${fnSrc})(s);localStorage.setItem(k,JSON.stringify(s));return true})()`)
}

try {
  // ── 1. A live escalation nobody takes becomes a request ──
  await stage(); await r19()
  await sim('sim-asks-live')
  ok('1: the escalation is offered live first', (await text('[data-testid=escalation-outcome]')) === 'Offered to standby moderators, one at a time', await text('[data-testid=escalation-outcome]'))
  await mod('requests')
  ok('1: while it is still being offered, it is not a request yet', !(await rowOf('P-2042')))
  await r19(); await sim('sim-live-declines')
  ok('1: the first moderator declining offers it to the next', (await text('[data-testid=escalation-outcome]')) === 'Offered to standby moderators, one at a time')
  await sim('sim-live-timeout')
  ok('1: after the last one, the AI asks for a time and it is a request waiting', (await text('[data-testid=escalation-outcome]')) === 'Asked for a time that suits them', await text('[data-testid=escalation-outcome]'))
  const esc = await withMod(`(async()=>{const s=JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks['moisturizer-concept'].sessions.find(x=>x.id==='${SID}');return {status:s.escalation.status,answers:s.escalation.live.answers,suggested:s.escalation.request.suggested,zone:s.escalation.request.zone,moderatorId:s.escalation.moderatorId}})()`)
  ok('1: one moderator declined and one timed out, both on record', Object.values(esc.answers).sort().join() === 'Declined,No answer', esc.answers)
  ok('1: the request carries one suggested time and the participant’s zone', !!esc.suggested && /^America\//.test(esc.zone), esc)
  await mod('requests')
  const r1 = await rowOf('P-2042')
  ok('1: it is on the Requests tab, Open, for a moderator on standby', !!r1 && r1.status === 'Open', r1)
  ok('1: the row has participant, study, language, AI covered, suggested time and a reason', !!r1 && /Maya|[A-Z][a-z]+ [A-Z]\./.test(r1.text) && /Moisturizer Concept Study/.test(r1.text) && /English \(US\)/.test(r1.text) && /Asked to speak with a person/.test(r1.text) && /Raised/.test(r1.text), r1?.text)
  ok('1: the suggested time shows in the moderator’s zone with the participant’s local time beside it', !!r1 && /EST|EDT/.test(r1.text) && /[A-Z][a-z]+ [A-Z]\.: .*(EST|EDT|CST|CDT|PST|PDT)/.test(r1.text), r1?.text)
  await countsMatch('1')

  // ── 2. Schedule at the suggested time: books the slot, moves it to Upcoming ──
  const before = await rowOf('P-2042')
  ok('2: Schedule at this time is enabled: Jordan is free then', before.buttons.find((x) => x.t === 'Schedule at this time')?.d === false, before.buttons)
  await clickTid('rq-schedule')
  ok('2: it leaves the Open list', !(await rowOf('P-2042')))
  await filter('Scheduled')
  const sch = await rowOf('P-2042')
  ok('2: and is Scheduled', !!sch && sch.status === 'Scheduled', sch)
  await countsMatch('2')
  await mod('upcoming')
  const up = await b.evaluate(`[...document.querySelectorAll('[data-testid=upcoming-row]')].find(r=>/P-2042/.test(r.innerText))?.innerText.replace(/\\s+/g,' ')`)
  ok('2: the session is in Upcoming with a Continued from AI tag', !!up && /Continued from AI/.test(up), up)
  ok('2: it says where the AI stopped and that nothing repeats', /already asked/.test(up ?? '') && /no repeats/.test(up ?? ''), up)
  ok('2: at the participant’s suggested time', await b.evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks['moisturizer-concept'].sessions.find(x=>x.id==='${SID}');return s.slot===s.escalation.request.suggested&&s.moderatorId==='u-jordan'&&s.status==='Booked'&&s.escalation.status==='Request accepted'})()`))
  await mod('availability')
  const booked = await b.evaluate(`[...document.querySelectorAll('[data-testid=avail-slot]')].filter(s=>s.dataset.kind==='booked').map(s=>s.innerText.replace(/\\s+/g,' '))`)
  ok('2: the slot shows in Availability as Booked: participant ID', booked.length === 1 && /Booked: P-2042/.test(booked[0]), booked)
  ok('2: and is no longer offered as a free time', !(await b.evaluate(`[...document.querySelectorAll('[data-testid=avail-slot]')].some(s=>s.dataset.kind==='free'&&s.innerText.startsWith(${JSON.stringify(booked[0].split(' · ')[0])}))`)))
  await r19()
  ok('2: the Researcher’s record shows it was scheduled', /Request accepted/.test((await text('[data-testid=escalation-outcome]')) ?? ''), await text('[data-testid=escalation-outcome]'))

  // ── 3. Taken: others see who took it, with no actions, and cannot book it ──
  await mod('requests'); await viewAs('u-priya'); await filter('Closed')
  const taken = await rowOf('P-2042')
  ok('3: Priya sees it as Taken by Jordan Lee', !!taken && taken.status === 'Taken by someone else' && /Taken by Jordan Lee/.test(taken.text), taken)
  ok('3: with no actions', !!taken && taken.buttons.length === 0, taken?.buttons)
  await countsMatch('3 (Priya)')
  const second = await withMod(`(async()=>{
    const fw = await window.__mod('/src/state/fieldwork')
    const raw = JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks['moisturizer-concept']
    const sess = raw.sessions.find((x) => x.id === '${SID}')
    const after = fw.scheduleRequest(raw, '${SID}', 'u-priya', [])
    const edit = fw.proposeRequestTime(raw, '${SID}', 'u-priya', sess.slot, [])
    const s2 = after.sessions.find((x) => x.id === '${SID}')
    return { same: after === raw, edited: edit === raw, by: s2.moderatorId, status: s2.escalation.status }
  })()`)
  ok('3: a second moderator can neither schedule nor edit a request that is taken', second.same && second.edited && second.by === 'u-jordan' && second.status === 'Request accepted', second)

  // ── 4. Blocked: not available, not free, time passed ──
  await stage(); await mod('requests')
  await clickTid('dev-create-request')
  const made = await rows()
  ok('4: Dev: create request raised one', made.length === 1 && made[0].status === 'Open', made)
  const asP = async (id) => { await viewAs(id); await filter('Open'); return rowOf(made[0].p) }
  const priya = await asP('u-priya')
  ok('4: Priya (evenings) is not available at noon: Schedule is disabled, with the reason', !!priya && priya.buttons.find((x) => x.t === 'Schedule at this time')?.d === true && /You aren’t available then/.test(priya.text), priya)
  ok('4: she can still edit the time or say she can’t take it', priya.buttons.some((x) => x.t === 'Edit time' && !x.d) && priya.buttons.some((x) => /Can’t take this/.test(x.t)))
  await viewAs('u-jordan'); await filter('Open')
  // Jordan is already holding that time: book the same slot to another participant.
  await mutate(`(s)=>{const d=s.fieldworks['${made[0].key.split('|')[0]}'];const r=d.sessions.find(x=>x.id==='${made[0].key.split('|')[1]}');const other=d.sessions.find(x=>x.id!==r.id);other.status='Booked';other.moderatorId='u-jordan';other.slot=r.escalation.request.suggested}`)
  await mod('requests')
  const clash = await rowOf(made[0].p)
  ok('4: Jordan is booked at that time: Schedule is disabled and says who with', !!clash && clash.buttons.find((x) => x.t === 'Schedule at this time')?.d === true && /You’re booked then \(P-\d+/.test(clash.text), clash?.text)
  await b.evaluate(`document.querySelector('[data-testid=rq-schedule]')?.click(); true`); await b.sleep(300)
  ok('4: pressing it does nothing: the request is still Open', (await rowOf(made[0].p))?.status === 'Open')
  // The time passes: the request stays Open and only Edit time works.
  await mutate(`(s)=>{const d=s.fieldworks['${made[0].key.split('|')[0]}'];const r=d.sessions.find(x=>x.id==='${made[0].key.split('|')[1]}');r.escalation.request.suggested='2026-11-11T12:00:00-05:00'}`)
  await mod('requests')
  const past = await rowOf(made[0].p)
  ok('4: a time that has passed stays Open', !!past && past.status === 'Open', past)
  ok('4: Schedule is disabled, says it passed, and only Edit time works', past.buttons.find((x) => x.t === 'Schedule at this time')?.d === true && /That time has passed/.test(past.text) && /This time has passed. Edit it to schedule/.test(past.text) && past.buttons.find((x) => x.t === 'Edit time')?.d === false, past.text)
  const pastCheck = await withMod(`(async()=>{const fw=await window.__mod('/src/state/fieldwork');const raw=JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks['${made[0].key.split('|')[0]}'];return fw.scheduleRequest(raw,'${made[0].key.split('|')[1]}','u-jordan',[])===raw})()`)
  ok('4: and the booking itself refuses a time that has passed', pastCheck)

  // ── 5. Edit time: waits for the participant; Accept schedules; Decline reopens ──
  await stage(); await mod('requests')
  await clickTid('dev-create-request')
  const e1 = (await rows())[0]
  await clickTid('rq-edit')
  await b.waitFor('Pick a time you are free')
  const slotRows = await b.evaluate(`[...document.querySelectorAll('[data-testid=edit-slots] label')].map(l=>l.innerText.replace(/\\s+/g,' '))`)
  ok('5: the picker lists free slots with the participant’s local time beside each', slotRows.length >= 5 && slotRows.every((t) => /(EST|EDT)/.test(t) && /[A-Z][a-z]+ [A-Z]\.: .*(EST|EDT|CST|CDT|PST|PDT)/.test(t)), slotRows.slice(0, 2))
  ok('5: every slot is in Jordan’s hours (10:00 to 16:00 ET, weekdays)', slotRows.every((t) => { const m = t.match(/(\d+):(\d\d) (AM|PM)/); const h = (Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0); return h >= 10 && h < 16 && !/^(Sat|Sun)/.test(t) }), slotRows)
  ok('5: Send new time stays disabled until one is picked', await b.evaluate(`document.querySelector('[data-testid=edit-confirm]').disabled`))
  await b.evaluate(`document.querySelectorAll('[data-testid=edit-slot]')[2].click(); true`); await b.sleep(200)
  const picked = await b.evaluate(`document.querySelectorAll('[data-testid=edit-slots] label')[2].innerText.split(String.fromCharCode(10))[0].trim()`)
  await clickTid('edit-confirm')
  await b.waitFor('Email sent to participant')
  ok('5: a toast says Email sent to participant', /Email sent to participant/.test(await b.evaluate('document.body.innerText')))
  const w = await rowOf(e1.p)
  ok('5: the request is Waiting for participant, with the proposed time shown', !!w && w.status === 'Waiting for participant' && /proposed/.test(w.text), w)
  ok('5: and has no Schedule or Edit', !!w && !w.buttons.some((x) => /Schedule|Edit time/.test(x.t)), w?.buttons)
  ok('5: it is still counted as open', Number(await text('[data-testid=mcount-requests]')) === 1)
  await countsMatch('5')
  await mod('availability')
  ok('5: the proposed time is held in Availability', (await count('[data-kind=held]')) === 1 && /Held for P-/.test(await text('[data-kind=held]')))
  await mod('requests')
  await viewAs('u-priya')
  const others = await rowOf(e1.p)
  ok('5: another moderator sees it as Waiting for participant with no actions', !!others && others.status === 'Waiting for participant' && !others.buttons.some((x) => /Schedule|Edit time|Can’t/.test(x.t)), others)
  await viewAs('u-jordan')
  await clickTid('dev-decline-time')
  const back = await rowOf(e1.p)
  ok('5: the participant declining returns it to Open, with Schedule available again', !!back && back.status === 'Open' && back.buttons.some((x) => x.t === 'Schedule at this time'), back)
  await clickTid('rq-edit'); await b.waitFor('Pick a time you are free')
  await b.evaluate(`document.querySelectorAll('[data-testid=edit-slot]')[2].click(); true`); await b.sleep(200)
  await clickTid('edit-confirm'); await b.sleep(300)
  await clickTid('dev-accept-time')
  const accepted = (await rows()).find((r) => r.p === e1.p)
  ok('5: the participant accepting schedules it', !accepted)
  await filter('Scheduled')
  ok('5: it is Scheduled', (await rowOf(e1.p))?.status === 'Scheduled')
  await mod('upcoming')
  const upEdited = await b.evaluate(`[...document.querySelectorAll('[data-testid=upcoming-row]')].find(r=>${JSON.stringify(e1.p)}&&r.innerText.includes(${JSON.stringify(e1.p)}))?.innerText.replace(/\\s+/g,' ')`)
  ok('5: it is in Upcoming at the edited time, continued from AI', !!upEdited && upEdited.includes(picked.split(',').slice(0, 2).join(',')) && /Continued from AI/.test(upEdited), { upEdited, picked })
  await mod('availability')
  ok('5: the slot is Booked, and the hold is gone', (await count('[data-kind=held]')) === 0 && (await count('[data-kind=booked]')) === 1)

  // ── 6. Can't take this, sort order, cancelled, counts ──
  await stage(); await mod('requests')
  await clickTid('dev-create-request')
  await clickTid('dev-create-request')
  const two = await rows()
  ok('6: two requests are listed', two.length === 2, two.map((r) => r.p))
  ok('6: soonest suggested time first', two[0].suggested <= two[1].suggested, two.map((r) => r.suggested))
  await countsMatch('6')
  await clickTid('rq-cant')
  ok('6: Can’t take this hides it for Jordan', (await rows()).length === 1)
  await countsMatch('6 after hiding')
  await viewAs('u-priya')
  ok('6: but Priya still sees it', (await rows()).length === 2)
  await clickTid('dev-cancel-request')
  await filter('Closed')
  const canc = (await rows()).find((r) => r.status === 'Cancelled by participant')
  ok('6: a request the participant cancelled is Closed: nothing to schedule, edit or decline, only Details', !!canc && canc.buttons.every((x) => x.t === 'Details') && /Cancelled by participant/.test(canc.text), canc)
  await countsMatch('6 (Priya, after a cancel)')
  await viewAs('u-jordan'); await filter('Open')
  await clickTid('rq-cant')
  await viewAs('u-priya'); await filter('Open')
  const left = await rows()
  await clickTid('rq-cant')
  const fell = await withMod(`(async()=>{const s=JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks;return Object.values(s).flatMap(d=>d.sessions).filter(x=>x.escalation?.declinedBy?.length).map(x=>[x.id,x.escalation.status,x.escalation.declinedBy.join('+')])})()`)
  ok('6: when every standby moderator can’t take it, it falls to the Researcher', left.length >= 1 && fell.some((x) => x[1] === 'Waiting for moderator' && x[2].includes('u-jordan') && x[2].includes('u-priya')), fell)

  // ── 7. Details ──
  await stage(); await mod('requests')
  await clickTid('dev-create-request')
  await clickTid('rq-details')
  if (!(await b.poll(`!!document.querySelector('[data-testid=rq-drawer]')`))) throw new Error('the details drawer did not open')
  ok('7: details show the transcript so far, the sections covered and the stimuli', (await count('[data-testid=rq-transcript] li')) >= 2 && /Intro \(\d of \d questions\)/.test((await text('[data-testid=rq-covered]')) ?? '') && !!(await text('[data-testid=rq-stimuli]')))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)

  // ── 8. The tab order ──
  const tabs = await b.evaluate(`[...document.querySelectorAll('[role=tab]')].map(t=>t.innerText.replace(/\\s+\\d+$/,'').trim())`)
  ok('8: the tabs are Upcoming | Requests | Completed | Submitted | Availability', tabs.join('|') === 'Upcoming|Requests|Completed|Submitted|Availability', tabs)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('MODERATOR REQUESTS FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('MODERATOR REQUESTS OK')
