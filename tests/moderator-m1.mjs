// Moderator view (M1) complete: the live escalation offered to every online standby moderator at once, the count rule,
// weekly availability editing, Upcoming (Join interview, Can't make it), scoping by who the moderator is, and the profile.
// Every step waits on state and every expectation is asserted.
//   npx vite --port 5199 --strictPort &   then   node tests/moderator-m1.mjs
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
  await b.sleep(350)
}
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
const setText = (sel, v, proto = 'HTMLTextAreaElement') => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(${proto}.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
// These tests start from empty tabs, so the Moderator view's mock data (src/mock/moderatorSeed.ts) is switched off for them.
const stage = async () => {
  await b.goto('/researcher'); await b.evaluate("localStorage.clear(); sessionStorage.clear(); localStorage.setItem('pulseai-qual:moderator-seed','off'); true"); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`)
}
const sim = async (tid) => {
  await b.evaluate(`document.querySelector('[role=dialog]') || __click('Screen jump'); true`); await b.sleep(250)
  await clickTid(tid)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`); await b.sleep(250)
}
const r19 = async (sid = SID) => { await b.goto(`${researcher}/fieldwork/sessions/${sid}`); await b.waitFor('Technical issues'); await b.sleep(600) }
const viewAs = async (id) => { await b.evaluate(`(()=>{const s=document.querySelector('[data-testid=view-as]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(id)});s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); await b.sleep(450) }
const mod = async (tab = 'requests') => { await b.goto(`/moderator/sessions?tab=${tab}`); await b.waitFor('My sessions'); await b.sleep(500) }
const mutate = async (fnSrc) => { await b.evaluate(`(()=>{const k='pulseai-qual:v2';const s=JSON.parse(localStorage.getItem(k));(${fnSrc})(s);localStorage.setItem(k,JSON.stringify(s));return true})()`) }
const sessionState = (id = SID) => withMod(`(async()=>{const s=JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks['moisturizer-concept'].sessions.find(x=>x.id==='${id}');return {status:s.status,es:s.escalation?.status,mod:s.moderatorId,slot:s.slot,declined:s.escalation?.live?.answers,started:s.escalation?.live?.startedAtMs,reassign:s.reassign,handled:s.handled}})()`)
/** P-2042 asks live and nobody takes it: a request for the moisturizer study, at noon Eastern the next weekday. */
const raise2042 = async () => { await r19(); await sim('sim-asks-live'); await sim('sim-live-timeout') }
const cards = () => b.evaluate(`[...document.querySelectorAll('[data-testid=live-card]')].map(c=>({p:c.dataset.participant,text:c.innerText.replace(/\\s+/g,' ')}))`)

try {
  // ═══ A. The live escalation is offered to everyone at once ═══
  await stage(); await r19()
  await sim('sim-asks-live')
  await mod('requests')
  const j = await cards()
  ok('A: Jordan has a pinned live card', j.length === 1 && j[0].p === 'P-2042', j)
  ok('A: it has the participant, ID, language, study, what the AI covered, a countdown, Accept and Decline', /[A-Z][a-z]+ [A-Z]\. P-2042/.test(j[0].text) && /English \(US\)/.test(j[0].text) && /Moisturizer Concept Study/.test(j[0].text) && /AI covered: Intro/.test(j[0].text) && /\d+ s left/.test(j[0].text) && /Accept/.test(j[0].text) && /Decline/.test(j[0].text), j[0]?.text)
  const cdJ = Number((await text('[data-testid=live-countdown]')).match(/(\d+) s left/)[1])
  ok('A: the countdown is under 60 seconds', cdJ > 0 && cdJ <= 60, cdJ)
  await mod('upcoming')
  ok('A: the card is pinned above every tab, not only Requests', (await count('[data-testid=live-card]')) === 1)
  await viewAs('u-priya')
  const p = await cards()
  const cdP = Number((await text('[data-testid=live-countdown]')).match(/(\d+) s left/)[1])
  ok('A: Priya has the card at the same moment', p.length === 1 && p[0].p === 'P-2042', p)
  ok('A: there is one 60-second timer in total: both see the same countdown', Math.abs(cdP - cdJ) <= 3, { cdJ, cdP })
  const st0 = await sessionState()
  ok('A: it is one offer to both, with one start time', Object.keys(st0.declined).length === 0 && st0.es === 'Offering live', st0)
  await clickTid('live-accept')
  const drawer = await b.poll(`!!document.querySelector('[data-testid=rq-drawer]')`)
  ok('A: Accept opens the handoff: transcript so far, sections covered, stimuli shown', drawer && (await count('[data-testid=rq-transcript] li')) >= 2 && /Intro/.test((await text('[data-testid=rq-covered]')) ?? '') && !!(await text('[data-testid=rq-stimuli]')) && !!(await text('[data-testid=handoff-note]')))
  const st1 = await sessionState()
  ok('A: the first to accept takes it', st1.es === 'Joined' && st1.mod === 'u-priya', st1)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(300)
  await viewAs('u-jordan')
  ok('A: the card is gone for Jordan', (await count('[data-testid=live-card]')) === 0)
  const late = await withMod(`(async()=>{const fw=await window.__mod('/src/state/fieldwork');const raw=JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks['moisturizer-concept'];return fw.liveOfferAnswered(raw,'${SID}','u-jordan','Accepted')===raw})()`)
  ok('A: and Jordan accepting late changes nothing', late)

  // Everyone declines: the AI asks for a time at once.
  await stage(); await r19(); await sim('sim-asks-live')
  await mod('requests'); await viewAs('u-priya')
  await clickTid('live-decline')
  ok('A: Priya declining takes the card from her only', (await count('[data-testid=live-card]')) === 0)
  await viewAs('u-jordan')
  ok('A: Jordan can still accept', (await count('[data-testid=live-card]')) === 1)
  ok('A: while one moderator can still accept, it is not a request', (await sessionState()).es === 'Offering live')
  await clickTid('live-decline')
  const afterAll = await sessionState()
  ok('A: when every moderator has declined, the AI asks for a time and a request is raised', afterAll.es === 'Time requested', afterAll)
  ok('A: the card is gone and the request is Open', (await count('[data-testid=live-card]')) === 0 && Number(await text('[data-testid=mcount-requests]')) === 1)

  // The 60 seconds run out for real: nobody answers.
  await stage(); await r19(); await sim('sim-asks-live')
  await mutate(`(s)=>{const e=s.fieldworks['moisturizer-concept'].sessions.find(x=>x.id==='${SID}').escalation;e.live.startedAtMs=Date.now()-61000}`)
  await mod('requests')
  await b.poll(`document.querySelectorAll('[data-testid=live-card]').length===0`, 5000)
  const timed = await sessionState()
  ok('A: after 60 seconds with nobody accepting, the AI asks for a time and a request is raised', timed.es === 'Time requested', timed)

  // ═══ B. The count rule: Open counts, Waiting for participant sits under Scheduled ═══
  await clickTid('rq-filter-Open')
  ok('B: the badge is the number of requests that need action', Number(await text('[data-testid=mcount-requests]')) === 1)
  await clickTid('rq-edit'); await b.waitFor('Pick a time you are free')
  await b.evaluate(`document.querySelectorAll('[data-testid=edit-slot]')[1].click(); true`); await b.sleep(200)
  await clickTid('edit-confirm')
  ok('B: once a new time waits on the participant the badge is 0', Number(await text('[data-testid=mcount-requests]')) === 0)
  ok('B: and Open is empty', (await count('[data-testid=request-row]')) === 0)
  await clickTid('rq-filter-Scheduled')
  ok('B: the request is under Scheduled as Waiting for participant', (await b.evaluate(`[...document.querySelectorAll('[data-testid=request-row]')].filter(r=>r.dataset.participant==='P-2042').map(r=>r.dataset.status)`)).join() === 'Waiting for participant')

  // ═══ C. Availability: weekly editing ═══
  await stage(); await raise2042(); await mod('requests')
  await clickTid('rq-schedule') // books Thursday noon, P-2042
  await mod('availability')
  const total = async () => Number((await text('[data-testid=avail-total]')).match(/Total (\d+)/)[1])
  const idx = (day, h) => h * 7 + day
  const cell = (day, h) => `document.querySelectorAll('[data-testid=avail-cell]')[${idx(day, h)}]`
  const stateOf = (day, h) => b.evaluate(`${cell(day, h)}.dataset.state`)
  const down = async (day, h) => { await b.evaluate(`(()=>{const c=${cell(day, h)};c.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));window.dispatchEvent(new MouseEvent('mouseup'));return true})()`); await b.sleep(200) }
  const t0 = await total()
  const grid = await b.evaluate(`(()=>{const sc=document.querySelector('[data-testid=avail-scroll]');const rows=[...document.querySelectorAll('[data-hour-row]')];const top=sc.getBoundingClientRect().top;const head=sc.querySelector('thead').getBoundingClientRect().height;const firstSeen=rows.find(r=>r.getBoundingClientRect().bottom>top+head+1);return {cells:document.querySelectorAll('[data-testid=avail-cell]').length,labels:rows.map(r=>r.querySelector('th').innerText.trim()),scrollTop:sc.scrollTop,first:Number(firstSeen.dataset.hourRow)}})()`)
  ok('C: the grid shows all 24 hours, 12 AM to 11 PM, for seven days', grid.cells === 168 && grid.labels.length === 24 && grid.labels[0] === '12 AM' && grid.labels[12] === '12 PM' && grid.labels[23] === '11 PM', { cells: grid.cells, labels: [grid.labels[0], grid.labels[23]] })
  ok('C: it opens scrolled to the working day (about 8 AM), not midnight', grid.scrollTop > 0 && grid.first >= 7 && grid.first <= 9, grid)
  await b.evaluate(`document.querySelector('[data-testid=avail-scroll]').scrollTop=0; true`); await b.sleep(150)
  await down(4, 2)
  ok('C: the small hours can be edited too (Friday 2 AM adds, then goes again)', (await stateOf(4, 2)) === 'on' && (await total()) === t0 + 1)
  await b.evaluate(`${cell(4, 2)}.querySelector('[data-testid=avail-remove]').click(); true`); await b.sleep(300)
  await clickTid('coverage-confirm')
  ok('C: and removing it (nobody else covers 2 AM) asked first', (await stateOf(4, 2)) === 'off' && (await total()) === t0)
  ok('C: the grid is labelled with the moderator’s time zone', /Eastern Time/.test((await text('[data-testid=zone-label]')) ?? ''), await text('[data-testid=zone-label]'))
  ok('C: each day shows its hours and the total is "Total N h / week"', (await b.evaluate(`[...document.querySelectorAll('[data-testid=day-head]')].map(h=>Number(h.innerText.match(/(\\d+) h/)[1])).reduce((a,x)=>a+x,0)`)) === t0 && t0 === 30, t0)
  ok('C: hours that have started are locked (Monday 10 AM)', (await stateOf(0, 10)) === 'past-on' && (await b.evaluate(`${cell(0, 10)}.querySelector('[data-testid=avail-remove]')`)) === null)
  await down(0, 10)
  ok('C: clicking a locked hour changes nothing', (await total()) === t0)
  await down(0, 8)
  ok('C: nor does adding an hour that has passed', (await total()) === t0 && (await stateOf(0, 8)) === 'past-off')
  ok('C: Friday 4 PM is empty, so clicking it adds the hour', (await stateOf(4, 16)) === 'off')
  await down(4, 16)
  ok('C: it is added, and the total is one more', (await stateOf(4, 16)) === 'on' && (await total()) === t0 + 1, await total())
  // Drag across empty hours.
  await b.evaluate(`(()=>{const c=${cell(5, 10)};c.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));for(const h of [11,12]){const n=${cell(5, 11).replace('11', '__H__')};}return true})()`).catch(() => undefined)
  await b.evaluate(`(()=>{const rows=document.querySelectorAll('[data-testid=avail-cell]');const at=(d,h)=>rows[h*7+d];at(5,10).dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));for(const h of [11,12]){at(5,h).dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));}window.dispatchEvent(new MouseEvent('mouseup'));return true})()`)
  await b.sleep(250)
  ok('C: dragging across empty hours adds them all', (await stateOf(5, 10)) === 'on' && (await stateOf(5, 11)) === 'on' && (await stateOf(5, 12)) === 'on' && (await total()) === t0 + 4, await total())
  // Remove: Saturday hours are nobody's coverage but Jordan's, so removing asks first.
  await b.evaluate(`${cell(5, 10)}.querySelector('[data-testid=avail-remove]').click(); true`); await b.sleep(300)
  ok('C: removing an hour the standby coverage depends on shows a warning first', (await count('[data-testid=coverage-lines] li')) >= 1 && /Moisturizer Concept Study/.test((await text('[data-testid=coverage-lines]')) ?? ''), await text('[data-testid=coverage-lines]'))
  ok('C: and nothing is removed yet', (await stateOf(5, 10)) === 'on')
  await clickTid('coverage-keep')
  ok('C: Keep it leaves the hour', (await stateOf(5, 10)) === 'on' && (await count('[data-testid=coverage-lines]')) === 0)
  await b.evaluate(`${cell(5, 10)}.querySelector('[data-testid=avail-remove]').click(); true`); await b.sleep(300)
  await clickTid('coverage-confirm')
  ok('C: Remove anyway takes it off', (await stateOf(5, 10)) === 'off' && (await total()) === t0 + 3)
  // An hour Priya covers (Friday 5 PM, her 17:00 to 20:00) removes with no warning.
  await down(4, 17)
  ok('C: Friday 5 PM added', (await stateOf(4, 17)) === 'on')
  await b.evaluate(`${cell(4, 17)}.querySelector('[data-testid=avail-remove]').click(); true`); await b.sleep(300)
  ok('C: an hour another standby moderator covers is removed with no warning', (await count('[data-testid=coverage-lines]')) === 0 && (await stateOf(4, 17)) === 'off')
  // Booked can't be removed.
  const bookedState = await stateOf(3, 12)
  ok('C: the booked hour (Thursday noon, P-2042) is marked Booked: P-2042', bookedState === 'booked' && /Booked: P-2042/.test(await b.evaluate(`${cell(3, 12)}.innerText`)), bookedState)
  ok('C: a booked hour has no remove button', (await b.evaluate(`${cell(3, 12)}.querySelector('[data-testid=avail-remove]')`)) === null)
  await down(3, 12)
  ok('C: and pressing it does nothing', (await stateOf(3, 12)) === 'booked')
  const tryRemove = await withMod(`(async()=>{const av=await window.__mod('/src/state/availability');const rq=await window.__mod('/src/state/requests');const fw=JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks;const held=rq.heldHours(fw,'u-jordan');return {held:[...held.keys()].length}})()`)
  ok('C: the booked hour is held by the booking, in every study', tryRemove.held >= 1, tryRemove)

  // Week navigation, Copy last week, Repeat every week, Clear this week.
  const label0 = await text('[data-testid=week-label]')
  await clickTid('week-next')
  ok('C: next week shows another week, with nothing locked', (await text('[data-testid=week-label]')) !== label0 && (await b.evaluate(`[...document.querySelectorAll('[data-testid=avail-cell]')].every(c=>!c.dataset.state.startsWith('past'))`)))
  const nextTotal = await total()
  ok('C: an unedited week starts from the usual hours (30)', nextTotal === 30, nextTotal)
  await clickTid('week-menu'); await clickTid('week-clear')
  ok('C: clearing a week that standby coverage depends on warns first', /Clearing this week leaves/.test((await text('[role=dialog]')) ?? ''), await text('[role=dialog]'))
  await clickTid('coverage-confirm')
  ok('C: Clear this week empties it', (await total()) === 0)
  await clickTid('week-menu'); await clickTid('week-copy')
  const copied = await total()
  ok('C: Copy last week brings this week’s hours here (30 usual, plus the 3 I added)', copied === t0 + 3, { copied, t0 })
  await clickTid('week-menu'); await clickTid('week-repeat')
  await clickTid('week-next')
  ok('C: Repeat every week makes the weeks after follow it', (await total()) === copied, { copied, later: await total() })
  await clickTid('week-prev'); await clickTid('week-prev'); await clickTid('week-prev')
  await clickTid('week-menu')
  ok('C: a week that has passed can’t be changed from the menu', await b.evaluate(`['week-copy','week-repeat','week-clear'].every(t=>document.querySelector('[data-testid='+t+']').disabled)`))

  // What a moderator sets decides what can be booked.
  await stage(); await mod('availability')
  await b.evaluate(`document.querySelectorAll('[data-testid=avail-cell]')[${idx(4, 15)}].querySelector('[data-testid=avail-remove]').click(); true`); await b.sleep(300)
  await clickTid('coverage-confirm')
  const free = await withMod(`(async()=>{const st=await window.__mod('/src/state/standby');const fw=JSON.parse(localStorage.getItem('pulseai-qual:v2')).fieldworks['moisturizer-concept'];const f=st.freeSlots({id:'u-jordan',name:'Jordan Lee'},'2026-11-11T17:00:00-05:00',[]);const fri=f.filter(s=>new Date(s.start).toISOString().startsWith('2026-11-13'));return fri.map(s=>new Date(s.start).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}))})()`)
  ok('C: an hour taken off is no longer offered to a participant', free.length > 0 && !free.some((t) => /^3:/.test(t)), free)

  // ═══ D. Upcoming: Join interview and Can't make it ═══
  await stage(); await raise2042(); await mod('requests')
  await clickTid('rq-schedule')
  await mod('upcoming')
  const join0 = await b.evaluate(`(()=>{const e=document.querySelector('[data-testid=join-interview]');return {disabled:e.disabled||e.getAttribute('aria-disabled')==='true',title:e.title}})()`)
  ok('D: Join interview is not active until 10 minutes before the slot', join0.disabled && /10 minutes/.test(join0.title), join0)
  const slotIso = (await sessionState()).slot
  await mutate(`(s)=>{const d=s.fieldworks['moisturizer-concept'];d.clockSkewMin=Math.round((new Date('${slotIso}').getTime()-5*60000-new Date('2026-11-11T17:00:00-05:00').getTime())/60000)}`)
  await mod('upcoming')
  const join1 = await b.evaluate(`(()=>{const e=document.querySelector('[data-testid=join-interview]');return {disabled:e.disabled||e.getAttribute('aria-disabled')==='true',href:e.getAttribute('href')}})()`)
  ok('D: five minutes before, it is active and goes to the interview', !join1.disabled && /console$/.test(join1.href ?? ''), join1)
  await clickTid('join-interview'); await b.sleep(500)
  ok('D: it opens the placeholder until the console exists', /\/moderator\/sessions\/P-2042-1\/console/.test(await b.evaluate('location.pathname')))
  await mod('upcoming')
  await clickTid('row-menu'); await clickTid('cant-make-it')
  ok('D: Can’t make it needs a reason', await b.evaluate(`document.querySelector('[data-testid=reassign-send]').disabled`))
  await b.evaluate(setText('[role=dialog] textarea', 'A clash I can’t move.')); await b.sleep(250)
  await clickTid('reassign-send')
  ok('D: the row says you asked for someone else', /You asked for someone else/.test((await text('[data-testid=upcoming-row]')) ?? ''))
  const rs = await sessionState()
  ok('D: the request, with the reason, is on the session', rs.reassign?.reason === 'A clash I can’t move.' && rs.reassign.by === 'u-jordan' && rs.mod === 'u-jordan', rs)
  await clickTid('row-menu')
  ok('D: and it can’t be sent twice', await b.evaluate(`document.querySelector('[data-testid=cant-make-it]').disabled`))
  await b.goto(`${researcher}/fieldwork/command-center`); await b.waitFor('Needs you'); await b.sleep(800)
  const needs = await b.evaluate(`[...document.querySelectorAll('[data-testid=needs-row][data-kind=reassign]')].map(r=>r.innerText.replace(/\\s+/g,' '))`)
  ok('D: the study’s Researcher sees it in Needs you, with the reason', needs.length === 1 && /Jordan Lee can’t make the booked time/.test(needs[0]) && /A clash I can’t move/.test(needs[0]), needs)
  await b.evaluate(`document.querySelector('[data-testid=needs-row][data-kind=reassign] button').click(); true`); await b.sleep(400)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] input[type=radio]')].find(i=>i.closest('label').innerText.includes('Priya')).click(); true`); await b.sleep(200)
  await clickTid('confirm-assign')
  const reassigned = await sessionState()
  ok('D: assigning a moderator moves the session and clears the request', reassigned.mod === 'u-priya' && !reassigned.reassign, reassigned)
  ok('D: and it leaves Needs you', (await b.evaluate(`document.querySelectorAll('[data-testid=needs-row][data-kind=reassign]').length`)) === 0)
  await mod('upcoming')
  ok('D: it is no longer in Jordan’s Upcoming', (await count('[data-testid=upcoming-row]')) === 0)
  await viewAs('u-priya')
  ok('D: it is in Priya’s', (await count('[data-testid=upcoming-row]')) === 1)

  // ═══ E. Scoping ═══
  await stage()
  await mutate(`(s)=>{Object.values(s.fieldworks).forEach(d=>d.plan.escalation.moderators.push({id:'tm-dana',name:'Dana Whitfield'}))}`)
  await mod('requests')
  await clickTid('dev-create-request'); await clickTid('dev-create-request')
  const studiesFor = async () => b.evaluate(`[...document.querySelectorAll('[data-testid=request-row]')].map(r=>r.innerText.includes('Moisturizer Concept Study')?'moisturizer':r.innerText.includes('Pet Food')?'pet':'?').sort().join()`)
  ok('E: a PulseAI moderator (Jordan) sees requests across clients', (await studiesFor()) === 'moisturizer,pet', await studiesFor())
  await viewAs('u-priya')
  ok('E: so does Priya', (await studiesFor()) === 'moisturizer,pet')
  await viewAs('tm-dana')
  ok('E: a team moderator (Dana, Verdane Skincare) sees only her own company’s studies', (await studiesFor()) === 'moisturizer', await studiesFor())
  ok('E: and the count is the same list', Number(await text('[data-testid=mcount-requests]')) === 1)
  await mod('completed')
  ok('E: the other tabs follow: no Pet Food session is listed', !/P-31\d\d|P-3124/.test((await text('[data-testid=mpanel]')) ?? await b.evaluate('document.body.innerText')))
  await viewAs('tm-nisha')
  ok('E: an invited moderator sees only “Accept your invitation”', !!(await text('[data-testid=invite-gate]')) && /Accept your invitation/.test((await text('[data-testid=invite-gate]')) ?? '') && (await count('[role=tab]')) === 0 && (await count('[data-testid=request-row]')) === 0)
  ok('E: and has no Profile link, no live cards', !(await b.evaluate(`[...document.querySelectorAll('header a')].some(a=>/Profile/.test(a.innerText))`)) && (await count('[data-testid=live-card]')) === 0)
  await clickTid('dev-accept-invite')
  ok('E: accepting opens the view (and shows only Verdane’s studies)', (await count('[role=tab]')) === 5 && !(await b.evaluate(`document.body.innerText.includes('Pet Food')`)))

  // ═══ F. Profile ═══
  await stage(); await b.goto('/moderator/profile'); await b.waitFor('Profile'); await b.sleep(500)
  ok('F: email is read only', await b.evaluate(`(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.value==='jordan.lee@pulseai.example');return !!i&&(i.readOnly||i.disabled)})()`))
  ok('F: the time zone is shown', /Eastern Time/.test((await text('[data-testid=profile-zone]')) ?? ''))
  ok('F: Save is disabled until something changes', await b.evaluate(`document.querySelector('[data-testid=profile-save]').disabled`))
  const tags = await withMod(`(async()=>{const e=await window.__mod('/src/mock/expertise');const have=[...document.querySelectorAll('[data-testid=expertise-tags] button')].map(x=>x.dataset.tag);return {list:[...e.EXPERTISE_TAGS],have}})()`)
  ok('F: expertise tags come from the one shared list', tags.list.every((t) => tags.have.includes(t)), tags)
  await b.evaluate(`document.querySelector('[data-tag=Pricing]').click(); true`); await b.sleep(200)
  await b.evaluate(`(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.value==='Jordan Lee');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Jordan Lee-Park');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await b.sleep(250)
  await clickTid('profile-save')
  ok('F: the name changes everywhere it is shown, including the header', /Jordan Lee-Park/.test((await text('header')) ?? ''))
  const named = await withMod(`(async()=>{const fw=await window.__mod('/src/state/fieldwork');return fw.moderatorName('u-jordan')})()`)
  ok('F: and the Researcher sees the new name', named === 'Jordan Lee-Park', named)
  await b.goto('/moderator/profile'); await b.waitFor('Profile'); await b.sleep(400)
  ok('F: name and tag survive a refresh', /Jordan Lee-Park/.test(await b.evaluate(`[...document.querySelectorAll('input')].map(i=>i.value).join('|')`)) && (await b.evaluate(`document.querySelector('[data-tag=Pricing]').getAttribute('aria-pressed')`)) === 'true')
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('MODERATOR M1 FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('MODERATOR M1 OK')
