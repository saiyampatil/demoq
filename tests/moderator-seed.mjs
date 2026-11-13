// The Moderator view's mock data (src/mock/moderatorSeed.ts): every tab shows something for each seeded moderator, the
// number on every tab is the length of its list, the booked hours match Upcoming, a team moderator sees only their own
// company's studies, and the dev button still shows the pinned live card.
//   npx vite --port 5199 --strictPort &   then   node tests/moderator-seed.mjs
import { launch } from './cdp.mjs'
const b = await launch()
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
const fresh = async (flag) => {
  await b.goto('/researcher'); await b.evaluate(`localStorage.clear(); sessionStorage.clear(); ${flag ? `localStorage.setItem('pulseai-qual:moderator-seed','off');` : ''} true`); await b.goto('/researcher'); await b.waitFor('Screen jump')
}
const live = async () => {
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(600)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`)
}
const as = async (id) => { await b.evaluate(`localStorage.setItem('pulseai-qual:moderator-view-as', ${JSON.stringify(id)}); true`) }
const open = async (tab) => { await b.goto(`/moderator/sessions?tab=${tab}`); await b.waitFor('My sessions'); await b.sleep(450) }
const badge = async (t) => Number(await text(`[data-testid=mcount-${t}]`))
const rows = (sel) => b.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(r=>({text:r.innerText.replace(/\\s+/g,' '),status:r.dataset.status,session:r.dataset.session,p:r.dataset.participant,buttons:[...r.querySelectorAll('button,a')].map(x=>({t:x.innerText.trim(),d:x.disabled||x.getAttribute('aria-disabled')==='true'}))}))`)

/** Every tab has something, and the number on each is the length of its list. */
const everyTab = async (who, studiesWanted) => {
  await open('upcoming')
  const up = await rows('[data-testid=upcoming-row]')
  ok(`${who}: Upcoming has sessions, and the number is the list`, up.length >= 2 && (await badge('upcoming')) === up.length, { badge: await badge('upcoming'), rows: up.length })
  await open('requests')
  const openRows = await rows('[data-testid=request-row]')
  ok(`${who}: Requests has open requests, and the number is the Open list`, openRows.length >= 2 && (await badge('requests')) === openRows.length && openRows.every((r) => r.status === 'Open'), { badge: await badge('requests'), rows: openRows.length })
  const filters = await b.evaluate(`['Open','Scheduled','Closed'].map(f=>Number(document.querySelector('[data-testid=rq-filter-'+f+']').innerText.match(/(\\d+)$/)[1]))`)
  ok(`${who}: each filter's number is its list`, filters[0] === openRows.length)
  await clickTid('rq-filter-Scheduled')
  const sched = await rows('[data-testid=request-row]')
  ok(`${who}: Waiting for participant is under Scheduled`, sched.some((r) => r.status === 'Waiting for participant') && filters[1] === sched.length, { filters, sched: sched.map((r) => r.status) })
  await open('completed')
  const done = await rows('[data-testid=ended-row]')
  ok(`${who}: Completed has 3 interviews with recordings, one with notes not yet added`, done.length === 3 && (await badge('completed')) === 3 && done.every((r) => /Recording · \d+ min/.test(r.text)) && (await count('[data-testid=notes-state][data-state=none]')) === 1 && (await count('[data-testid=notes-state][data-state=draft]')) === 2, { n: done.length, none: await count('[data-testid=notes-state][data-state=none]') })
  await open('submitted')
  const sub = await rows('[data-testid=ended-row]')
  ok(`${who}: Submitted has 2 with notes, read only`, sub.length === 2 && (await badge('submitted')) === 2 && sub.every((r) => /Notes submitted/.test(r.text)) && (await count('[data-testid=submitted-list] textarea, [data-testid=submitted-list] input')) === 0, sub.length)
  await open('availability')
  const on = await count('[data-testid=avail-cell][data-state=on]')
  ok(`${who}: Availability has free hours this week`, on > 0, on)
  await clickTid('week-next')
  ok(`${who}: and next week`, (await count('[data-testid=avail-cell][data-state=on]')) > 0)
  await open('availability')
  const labels = await b.evaluate(`[...new Set([...document.querySelectorAll('[data-testid=avail-cell]')].filter(c=>/booked/.test(c.dataset.state)).map(c=>c.innerText.match(/P-\\d+/)?.[0]))]`)
  const upIds = up.map((r) => r.session.replace(/-1$/, ''))
  ok(`${who}: the booked hours show "Booked: participant ID" for exactly the Upcoming sessions`, upIds.every((p) => labels.includes(p)) && labels.length === upIds.length, { labels, upIds })
  return { up, openRows }
}

try {
  // ═══ Jordan Lee (PulseAI, Eastern): in the default state ═══
  await fresh(false)
  await everyTab('Jordan (default state)', 1)
  await open('upcoming')
  const ju = await rows('[data-testid=upcoming-row]')
  const soon = ju.find((r) => /Continued from AI/.test(r.text))
  ok('Jordan: one session is tagged Continued from AI and starts in about 15 minutes', !!soon && (await b.evaluate(`(()=>{const r=[...document.querySelectorAll('[data-testid=upcoming-row]')].find(x=>/Continued from AI/.test(x.innerText));return /5:15 PM/.test(r.innerText)})()`)), soon?.text)
  ok('Jordan: Join interview is there but not active yet', !!soon && soon.buttons.find((x) => /Join interview/.test(x.t))?.d === true, soon?.buttons)
  ok('Jordan: the others are later today and tomorrow', ju.length === 3 && ju.filter((r) => !/Continued from AI/.test(r.text)).some((r) => /Nov 11/.test(r.text)) && ju.some((r) => /Nov 12/.test(r.text)), ju.map((r) => r.text.slice(0, 40)))
  await open('requests')
  const jr = await rows('[data-testid=request-row]')
  const future = jr.find((r) => !/This time has passed/.test(r.text))
  const passed = jr.find((r) => /This time has passed/.test(r.text))
  ok('Jordan: one open request has a future time and can be scheduled', !!future && future.buttons.find((x) => x.t === 'Schedule at this time')?.d === false, future?.buttons)
  ok('Jordan: one has a time that has passed: only Edit time works', !!passed && passed.buttons.find((x) => x.t === 'Schedule at this time')?.d === true && passed.buttons.find((x) => x.t === 'Edit time')?.d === false, passed?.text)
  ok('Jordan: each request shows participant, study, language, AI covered, and the time in his zone with the participant’s beside it', jr.every((r) => /[A-Z][a-z]+ [A-Z]\. P-\d+/.test(r.text) && /Pet Food Subscription Churn/.test(r.text) && /English \(US\)/.test(r.text) && /Intro/.test(r.text) && /(EST|EDT)/.test(r.text) && /[A-Z][a-z]+ [A-Z]\.: .*(EST|EDT|CST|CDT|PST|PDT)/.test(r.text)), jr[0]?.text)
  await clickTid('rq-filter-Scheduled')
  const waiting = (await rows('[data-testid=request-row]')).find((r) => r.status === 'Waiting for participant')
  ok('Jordan: the Waiting for participant request shows the time he proposed', !!waiting && /proposed/.test(waiting.text), waiting?.text)

  // The pinned live card, from the dev button.
  await open('upcoming')
  ok('Jordan: no live card until one is triggered', (await count('[data-testid=live-card]')) === 0)
  await clickTid('dev-trigger-escalation')
  await b.poll(`document.querySelectorAll('[data-testid=live-card]').length===1`, 4000)
  ok('Jordan: Dev: trigger escalation pins the live card above the tabs', (await count('[data-testid=live-card]')) === 1 && /Accept/.test((await text('[data-testid=live-card]')) ?? ''), await text('[data-testid=live-card]'))

  // ═══ Ravi Menon (team moderator, Burrow Pet, India), in the same default state ═══
  await as('tm-ravi')
  await everyTab('Ravi (team, default state)', 1)
  await open('requests')
  const br = await rows('[data-testid=request-row]')
  await open('upcoming')
  const bu = await rows('[data-testid=upcoming-row]')
  ok('Ravi: everything is from his own company’s study (Pet Food Subscription Churn)', [...br, ...bu].every((r) => /Pet Food Subscription Churn/.test(r.text)), [...br, ...bu].map((r) => r.text.slice(0, 50)))
  ok('Ravi: three upcoming, one Continued from AI starting in about 15 minutes with Join not active yet', bu.length === 3 && bu.some((r) => /Continued from AI/.test(r.text) && r.buttons.find((x) => /Join interview/.test(x.t))?.d === true), bu.map((r) => r.text.slice(0, 60)))
  ok('Ravi: his times are in his own zone (IST), with the participant’s beside them', bu.every((r) => /IST/.test(r.text) && /[A-Z][a-z]+ [A-Z]\.: /.test(r.text)), bu.map((r) => r.text.slice(0, 80)))
  await open('requests')
  const rf = (await rows('[data-testid=request-row]')).find((r) => !/This time has passed/.test(r.text))
  ok('Ravi: a request at noon Eastern is outside his hours: Schedule is disabled with the reason, and Edit time works', !!rf && rf.buttons.find((x) => x.t === 'Schedule at this time')?.d === true && /You aren’t available then/.test(rf.text) && rf.buttons.find((x) => x.t === 'Edit time')?.d === false, rf?.text)
  await open('availability')
  ok('Ravi: the grid is labelled India Standard Time', /India Standard Time/.test((await text('[data-testid=zone-label]')) ?? ''), await text('[data-testid=zone-label]'))
  const evening = await b.evaluate(`[...document.querySelectorAll('[data-testid=avail-cell][data-state=on], [data-testid=avail-cell][data-state=past-on]')].map(c=>new Date(c.dataset.hour).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}))`)
  ok('Ravi: his free hours are US evenings (5:30 to 8:30 PM Eastern)', evening.length >= 3 && evening.every((h) => /^(5:30|6:30|7:30) PM$/.test(h)), evening)
  await as('u-jordan')
  await open('requests')
  ok('Jordan and Ravi see the same three requests (Open, Open, Waiting) and each number is its list', (await badge('requests')) === 2)

  // ═══ Switched off: empty tabs ═══
  await fresh(true)
  await open('upcoming')
  ok('with the seed switched off, the tabs are empty again', (await count('[data-testid=upcoming-row]')) === 0 && (await badge('requests')) === 0 && (await badge('completed')) <= 1 && (await badge('submitted')) === 0)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('MODERATOR SEED FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('MODERATOR SEED OK')
