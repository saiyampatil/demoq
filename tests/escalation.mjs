// R18/R19: a participant in an AI interview asks to talk to a person. The three things they can choose (book a free time, ask
// for a time, end the interview), what the moderator answers, what lands in Needs you, and what the Researcher can do about it.
// Every step waits on state and every expectation is asserted: the script exits 1 and says which one failed.
//   npx vite --port 5199 --strictPort &   then   node tests/escalation.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const SID = 'P-2042-1' // in progress in the "Live in fieldwork" seed, so it can ask
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail ? `${label} (${detail})` : label)
}
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
const text = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const clickTid = async (tid) => {
  const done = await b.poll(`(()=>{const e=document.querySelector('[data-testid=${tid}]');if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for [data-testid=${tid}]`)
  await b.sleep(400)
}
const fresh = async () => {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
}
const r19 = async (sid = SID) => { await b.goto(`${root}/fieldwork/sessions/${sid}`); await b.waitFor('Technical issues'); await b.sleep(600) }
// What stands in for the participant and the moderator lives in the Screen jump panel, so open it, act, close it.
const sim = async (tid) => {
  await b.evaluate(`document.querySelector('[role=dialog]') || __click('Screen jump'); true`); await b.sleep(250)
  await clickTid(tid)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`); await b.sleep(250)
}
const outcome = () => text('[data-testid=escalation-outcome]')
const needsAll = async () => {
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(800)
  await b.evaluate(`[...document.querySelectorAll('#needs-you button')].find(x=>/^Show all/.test(x.innerText.trim()))?.click(); true`); await b.sleep(250)
  return b.evaluate(`document.querySelector('#needs-you')?.innerText.replace(/\\s+/g,' ')`)
}
const inNeeds = async () => (await needsAll()).includes('P-2042')
const sessionStatus = () => b.evaluate(`document.querySelector('main').innerText.match(/Status\\s+([A-Za-z() ]+?)\\s+Length/)?.[1] ?? null`)

try {
  // ── A. Asks for a time, the moderator declines, it falls to the Researcher, who assigns a moderator ──
  await fresh(); await r19()
  await sim('sim-requests')
  ok('A: asking for a time is recorded', (await outcome()) === 'Asked for a time that suits them', await outcome())
  ok('A: a request still within its promise is not in Needs you', !(await inNeeds()))
  await r19(); await sim('sim-mod-declines')
  ok('A: a declined request waits for a moderator', (await outcome()) === 'Waiting for a moderator', await outcome())
  const needsA = await needsAll()
  const rowA = await text('[data-testid=escalation-row]')
  ok('A: it is pinned in Needs you as an escalation', !!rowA && rowA.includes('P-2042') && /Waiting for moderator/.test(rowA), rowA)
  ok('A: it is the first row', await b.evaluate(`document.querySelector('#needs-you ul > li')?.dataset.testid==='escalation-row'`))
  ok('A: it is our side, never the participant’s fault', /Our side/.test(rowA ?? ''))
  ok('A: it offers Assign moderator and Send booking link', await b.evaluate(`!!document.querySelector('[data-testid=escalation-row] [data-testid=assign-moderator]')&&!!document.querySelector('[data-testid=escalation-row] [data-testid=send-booking-link]')`))
  const clock0 = await text('[data-testid=escalation-clock]')
  ok('A: the clock counts down the promise', /left on the promise/.test(clock0 ?? ''), clock0)
  await b.shot('e3-pinned')
  await r19(); await sim('sim-23h')
  await needsAll()
  const clock1 = await text('[data-testid=escalation-clock]')
  ok('A: 23 h more on the wait moves the clock', !!clock1 && clock1 !== clock0, `${clock0} -> ${clock1}`)
  await clickTid('assign-moderator')
  ok('A: Assign opens a roster to pick from', await b.evaluate(`document.querySelectorAll('[role=dialog] input[type=radio]').length>=2`))
  ok('A: nobody is picked for the Researcher', await b.evaluate(`document.querySelector('[data-testid=confirm-assign]').disabled`))
  await b.shot('e3-assign')
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] input[type=radio]')].find(r=>!r.disabled).click(); true`); await b.sleep(300)
  await clickTid('confirm-assign')
  ok('A: assigning says who was notified', /was notified about P-2042/.test((await text('[data-testid=toast]')) ?? ''))
  ok('A: it leaves Needs you once assigned', !(await inNeeds()))
  await r19()
  ok('A: the session records the assignment', (await outcome()) === 'Moderator assigned', await outcome())
  await sim('sim-assigned-joins')
  ok('A: and then that the moderator joined', (await outcome()) === 'A moderator joined', await outcome())

  // ── B. Asks for a time and the moderator accepts: never in Needs you, and listed as Escalated ──
  await fresh(); await r19()
  await sim('sim-requests'); await sim('sim-mod-accepts')
  ok('B: an accepted request has a confirmed time', (await outcome()) === 'Request accepted, time confirmed', await outcome())
  ok('B: it is not in Needs you', !(await inNeeds()))
  await b.goto(root + '/fieldwork/command-center?tab=sessions&filter=Escalated'); await b.waitFor('Overview'); await b.sleep(900)
  const escalated = await b.evaluate(`[...document.querySelectorAll('#fw-panel tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' '))`)
  ok('B: the Escalated filter lists it', escalated.length >= 1 && escalated.some((r) => r.includes('P-2042') && /Escalated: request accepted/i.test(r)), escalated.join(' || '))

  // ── C. Falls to the Researcher, who sends a booking link ──
  await fresh(); await r19(); await sim('sim-requests'); await sim('sim-mod-declines')
  ok('C: in Needs you before the link', await inNeeds())
  await clickTid('send-booking-link')
  ok('C: sending says so', /Booking link sent to P-2042/.test((await text('[data-testid=toast]')) ?? ''))
  ok('C: it leaves Needs you', !(await inNeeds()))
  await r19()
  ok('C: the session says a booking link was sent', (await outcome()) === 'Booking link sent', await outcome())
  ok('C: and is Booked', (await sessionStatus()) === 'Booked', await sessionStatus())

  // ── D. Falls to the Researcher, who gives up with a reason ──
  await fresh(); await r19(); await sim('sim-requests'); await sim('sim-mod-declines')
  await needsAll()
  await b.evaluate(`document.querySelector('[data-testid=escalation-row] button[aria-label^="Give up and replace"]').click(); true`); await b.sleep(400)
  ok('D: giving up needs a reason', await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(x=>/^Give up and open the slot/.test(x.innerText))?.disabled===true`))
  await b.evaluate(setText('[role=dialog] textarea', 'No moderator free this week.')); await b.sleep(250)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(x=>/^Give up and open the slot/.test(x.innerText)).click(); true`); await b.sleep(500)
  ok('D: it leaves Needs you', !(await inNeeds()))
  await r19()
  const bodyD = await b.evaluate(`document.querySelector('main').innerText.replace(/\\s+/g,' ')`)
  ok('D: the session is marked given up, with the reason', /Given up/.test(bodyD) && /No moderator free this week/.test(bodyD))

  // ── E. Books a free time straight away ──
  await fresh(); await r19()
  await sim('sim-books')
  ok('E: booking a free time is recorded', (await outcome()) === 'Booked a time with a moderator', await outcome())
  ok('E: the session is Booked for it', (await sessionStatus()) === 'Booked', await sessionStatus())
  ok('E: no answer is needed, so it is not in Needs you', !(await inNeeds()))

  // ── F. Ends the interview ──
  await fresh(); await r19()
  await sim('sim-ends')
  ok('F: ending is recorded', (await outcome()) === 'Ended the interview', await outcome())
  ok('F: the session is Withdrawn', (await sessionStatus()) === 'Withdrawn', await sessionStatus())
  ok('F: a withdrawn participant is not in Needs you for the request', !(await inNeeds()))

  // ── G. Pet Food has one of each in the past ──
  await b.goto('/researcher/studies/pet-food-churn/fieldwork/sessions/P-3115-1'); await b.waitFor('Talk to a person'); await b.sleep(600)
  ok('G: an old booked-and-joined request reads that way', (await outcome()) === 'A moderator joined', await outcome())
  const timeline = await b.evaluate(`[...document.querySelectorAll('main ol li')].map(l=>l.innerText.replace(/\\s+/g,' '))`)
  ok('G: its timeline shows the ask, the booking and the join', ['Asked to talk to a human moderator', 'Booked a time with Jordan Lee', 'Jordan Lee joined'].every((t) => timeline.some((l) => l.includes(t))), timeline.join(' | '))
  await b.shot('e3-pet-card')

  ok('invariants hold', !(await b.evaluate('window.__invariants'))?.length)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('ESCALATION FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('ESCALATION OK')
