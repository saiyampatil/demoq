// Fieldwork to Review: simulate an Active session completing, then check every count moved together (and by exactly one).
//   npx vite --port 5199 --strictPort &   then   node tests/bridge.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
const failures = []
const ok = (label, cond, detail) => { if (!cond) failures.push(detail ? `${label} (${detail})` : label) }
const num = (re, s) => Number((String(s ?? '').match(re) ?? [])[1])
/** Every count the completed session should move, read from where each screen shows it now. */
const counts = async () => {
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Fieldwork command center'); await b.sleep(1000)
  const r18 = await b.evaluate(T)
  const c = {
    accepted: num(/(\d+) accepted, \d+ under review/, r18),
    underReview: num(/\d+ accepted, (\d+) under review/, r18),
    awaitingR18: num(/Awaiting review (\d+)/, r18),
    funnelCompleted: num(/Completed (\d+)/, r18.slice(r18.indexOf('Participant journey'))),
  }
  await b.goto(root + '/review/queue'); await b.waitFor('Completed interviews'); await b.sleep(1000)
  const cards = await b.evaluate(`document.querySelector('section[aria-label=Summary]')?.innerText.replace(/\\s+/g,' ')`)
  c.completedR21 = num(/Completed interviews (\d+)/, cards)
  c.awaitingR21 = num(/Awaiting review (\d+)/, cards)
  c.badge = num(/Review\s+(\d+) awaiting/, await b.evaluate(`document.body.innerText.replace(/\\s+/g,' ')`))
  return c
}
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  const before = await counts()
  ok('every count exists before', Object.values(before).every(Number.isFinite), JSON.stringify(before))

  // The first Active session. Its ID is in the row's first cell. (The search box's text is a placeholder, so wait on the tab bar.)
  await b.goto(root + '/fieldwork/command-center?tab=sessions'); await b.waitFor('Overview'); await b.sleep(700)
  const active = await b.evaluate(`[...document.querySelectorAll('#fw-panel tbody tr')].find(r=>/Active/.test(r.innerText))?.querySelector('a, td')?.innerText.trim().split('\\n')[0]`)
  ok('there is an Active session to complete', !!active, String(active))
  const sid = String(active).replace(/\s+/g, '').slice(0, 6) + '-1'

  // "Simulate: session completes" is in the Screen jump panel on a session page.
  await b.goto(`${root}/fieldwork/sessions/${sid}`); await b.waitFor('Technical issues'); await b.sleep(400)
  await b.evaluate(`document.querySelector('[role=dialog]') || __click('Screen jump'); true`); await b.sleep(300)
  await b.poll(`(()=>{const e=document.querySelector('[data-testid=simulate-complete]');if(!e||e.disabled)return false;e.click();return true})()`)
  await b.sleep(500)
  const msg = await b.evaluate(`document.querySelector('[data-testid=simulated]')?.innerText`)
  ok('the simulator says the session completed and is under review', /completed/i.test(msg ?? '') && /Under review/.test(msg ?? ''), msg)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`)

  const after = await counts()
  const d = (k) => after[k] - before[k]
  ok('under review +1', d('underReview') === 1, `${before.underReview} -> ${after.underReview}`)
  ok('R18 awaiting review +1', d('awaitingR18') === 1)
  ok('funnel Completed +1', d('funnelCompleted') === 1)
  ok('R21 completed interviews +1', d('completedR21') === 1)
  ok('R21 awaiting review +1', d('awaitingR21') === 1)
  ok('stepper Review badge +1', d('badge') === 1)
  ok('accepted unchanged', d('accepted') === 0)
  ok('R18 and R21 agree on awaiting review', after.awaitingR18 === after.awaitingR21 && after.badge === after.awaitingR21, JSON.stringify(after))

  await b.goto(root + '/review/queue'); await b.waitFor('Completed interviews'); await b.sleep(900)
  const row = await b.evaluate(`[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes(${JSON.stringify(sid.slice(0, 6))}))?.innerText.replace(/\\s+/g,' ')`)
  ok('the session is a row in the Review queue, Under review', !!row && /Under review/.test(row), String(row))
  await b.goto(`${root}/review/session/${sid}`); await b.waitFor('Session'); await b.sleep(1200)
  ok('R22 opens for it', (await b.evaluate(T)).includes(sid.slice(0, 6)))
  await b.shot('bridge-r22')
  ok('invariants hold', !(await b.evaluate(`window.__invariants`))?.length)
  console.log('before', JSON.stringify(before), '\nafter ', JSON.stringify(after), '\nsession', sid)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(failures.length ? 'BRIDGE FAILED:\n - ' + failures.join('\n - ') : 'BRIDGE OK')
if (failures.length) process.exitCode = 1
