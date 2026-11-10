// Stage 2, the bridges: Review decisions move Fieldwork, and the other way round, from Accept and Exclude through the reserve, a
// clarification, a reopen, closing fieldwork and unlocking Analysis. Every step's numbers are asserted.
//   npx vite --port 5199 --strictPort &   then   node tests/stage2.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
const failures = []
const ok = (label, cond, detail) => { if (!cond) failures.push(detail ? `${label} (${detail})` : label) }
const num = (re, s) => Number((String(s ?? '').match(re) ?? [])[1])
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
const snap = async () => {
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Fieldwork command center'); await b.sleep(1000)
  const t = await b.evaluate(T)
  return {
    accepted: num(/(\d+) accepted, \d+ under review/, t),
    underReview: num(/\d+ accepted, (\d+) under review/, t),
    target: num(/Toward target \d+ of (\d+)/, t),
    counted: num(/Toward target (\d+) of \d+/, t),
    gap: num(/(\d+) more (?:person|people) needed/, t),
    level: await b.evaluate(`document.querySelector('[aria-label=Verdict]')?.dataset.level ?? null`),
    buttons: await b.evaluate(`[...document.querySelectorAll('[aria-label="Verdict actions"] button, [aria-label="Verdict actions"] a')].map(x=>x.innerText.trim())`),
    badge: num(/Review\s+(\d+) awaiting/, await b.evaluate(`document.body.innerText.replace(/\\s+/g,' ')`)),
    invariants: await b.evaluate('window.__invariants'),
  }
}
const toast = () => b.evaluate(`document.querySelector('[data-testid=toast]')?.innerText.replace(/\\s+/g,' ') ?? null`)
const decide = async (sid, kind) => {
  await b.goto(`${root}/review/session/${sid}`); await b.waitFor('Decision'); await b.sleep(1100)
  await b.evaluate(`__click(${JSON.stringify(kind)})`); await b.sleep(400)
  if (kind === 'Exclude') { await b.evaluate(`document.querySelector('[role=dialog] input[type=checkbox]').click(); true`); await b.sleep(200); await b.evaluate(`__click('Exclude session')`) }
  if (kind === 'Accept') {
    await b.evaluate(setText('[role=dialog] textarea', 'Usable.')); await b.sleep(200)
    await b.evaluate(`(() => { const c=document.querySelector('[role=dialog] input[type=checkbox]'); if (c && !c.checked) c.click(); return true })()`); await b.sleep(200)
    await b.evaluate(`__click('Accept session')`)
  }
  await b.sleep(600)
  return toast()
}
const jump = async (fn) => {
  await b.evaluate(`document.querySelector('[role=dialog]') || __click('Screen jump'); true`); await b.sleep(300)
  await fn()
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`); await b.sleep(300)
}
const lockReason = () => b.evaluate(`(document.documentElement.innerHTML.match(/\\d+ of \\d+ sessions? still needs? a Review decision/) ?? [])[0] ?? null`)
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`)

  const s0 = await snap()
  ok('start: 1 accepted, 11 under review, 12 counted of 24', s0.accepted === 1 && s0.underReview === 11 && s0.counted === 12 && s0.target === 24, JSON.stringify(s0))
  ok('start: the badge and the verdict agree', s0.badge === 11 && s0.level === 'At risk' && s0.gap === 2, JSON.stringify(s0))

  // Accept moves one person from under review to accepted. Nobody is added or lost.
  await decide('P-2057-1', 'Accept')
  const s1 = await snap()
  ok('Accept: accepted +1, under review -1, counted unchanged', s1.accepted === s0.accepted + 1 && s1.underReview === s0.underReview - 1 && s1.counted === s0.counted, JSON.stringify(s1))
  ok('Accept: the badge follows', s1.badge === s1.underReview, `${s1.badge} vs ${s1.underReview}`)

  // Exclude frees a slot: counted -1, gap +1.
  await decide('P-2055-1', 'Exclude')
  const s2 = await snap()
  ok('Exclude: one fewer counted and one more needed', s2.counted === s1.counted - 1 && s2.gap === s1.gap + 1, JSON.stringify(s2))
  ok('Exclude: with no reserve the action is Open the reserve', s2.buttons.join('/') === 'Open the reserve', s2.buttons.join(' / '))

  // Applicants arrive in R8 and the reserve fills: the verdict now offers to invite from it.
  await b.goto(root + '/audience/sourcing'); await b.waitFor('Simulate'); await b.sleep(500)
  await b.evaluate(`__click('Simulate:')`); await b.sleep(800)
  const s3 = await snap()
  ok('Reserve: the verdict offers to invite people from it', s3.buttons.some((x) => /^Invite all \d+ from reserve/.test(x)), s3.buttons.join(' / '))
  await b.shot('s2-overview-reserve')
  const n = num(/Invite all (\d+)/, s3.buttons.find((x) => /^Invite all/.test(x)))
  await b.evaluate(`__click('Invite all')`); await b.sleep(700)
  const invited = await toast()
  ok('Invite: it says who was invited', /nvited/.test(invited ?? ''), invited)
  const s4 = await snap()
  ok('Invite: the gap closes by the number invited', s4.gap === Math.max(0, s3.gap - n) || s4.level !== 'At risk', `${s3.gap} - ${n} -> ${s4.gap} (${s4.level})`)

  // Request clarification keeps the session Under review, shows who it waits for, and is not in Needs you.
  await b.goto(`${root}/review/session/P-2054-1`); await b.waitFor('Decision'); await b.sleep(1100)
  await b.evaluate(`__click('Request clarification')`); await b.sleep(400)
  await b.evaluate(setText('[role=dialog] textarea', 'Can you confirm which concept you meant?')); await b.sleep(250)
  await b.evaluate(`__click('Send request')`); await b.sleep(600)
  const s5 = await snap()
  ok('Clarification: counts unchanged, still under review', s5.underReview === s4.underReview && s5.accepted === s4.accepted, JSON.stringify(s5))
  await b.goto(root + '/review/queue'); await b.waitFor('Completed interviews'); await b.sleep(1100)
  const row = await b.evaluate(`[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('P-2054'))?.innerText.replace(/\\s+/g,' ')`)
  ok('Clarification: the Review queue row says it is waiting for the participant', /Waiting for participant/.test(row ?? ''), row)
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(800)
  ok('Clarification: it is not in Needs you (a research matter)', !(await b.evaluate(`document.querySelector('#needs-you').innerText.includes('P-2054')`)))

  // Reopening the excluded session reverses the exclusion.
  await b.goto(`${root}/review/session/P-2055-1`); await b.waitFor('Decision record'); await b.sleep(800)
  await b.evaluate(`__click('Reopen for review')`); await b.sleep(400)
  await b.evaluate(setText('[role=dialog] textarea', 'Second look.')); await b.sleep(300)
  await b.evaluate(`__click('Reopen for review', '[role=dialog] button')`); await b.sleep(600)
  const s6 = await snap()
  ok('Reopen: it counts again, under review', s6.counted === s5.counted + 1 && s6.underReview === s5.underReview + 1, `${s5.counted}/${s5.underReview} -> ${s6.counted}/${s6.underReview}`)

  // Closing fieldwork is blocked while sessions are unfinished, and says why. Analysis is locked on every undecided session.
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Close fieldwork'); await b.sleep(600)
  ok('Close fieldwork is disabled while sessions are unfinished', await b.evaluate(`document.querySelector('[data-testid=close-fieldwork]')?.disabled === true`))
  ok('Analysis says how many sessions still need a Review decision', !!(await lockReason()), String(await lockReason()))

  // Clear the blockers: the running session completes and the people who never came are given up.
  await b.goto(`${root}/fieldwork/sessions/P-2042-1`); await b.waitFor('Technical issues'); await b.sleep(500)
  await jump(async () => { await b.poll(`(()=>{const e=document.querySelector('[data-testid=simulate-complete]');if(!e||e.disabled)return false;e.click();return true})()`); await b.sleep(500) })
  for (let i = 0; i < 10; i++) {
    // The Needs you card goes away when nothing needs the Researcher, so wait on the page, not on the card.
    await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Fieldwork command center'); await b.sleep(900)
    await b.evaluate(`[...document.querySelectorAll('#needs-you button')].find(x=>/^Show all/.test(x.innerText.trim()))?.click(); true`); await b.sleep(200)
    if (!(await b.evaluate(`!!__q('#needs-you button','Give up and replace')`))) break
    await b.evaluate(`__click('Give up and replace', '#needs-you button')`); await b.sleep(400)
    await b.evaluate(setText('[role=dialog] textarea', 'Unreachable.')); await b.sleep(300)
    await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].filter(x=>/Give up/.test(x.innerText)).pop().click(); true`); await b.sleep(500)
  }
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Close fieldwork'); await b.sleep(700)
  ok('Close fieldwork is enabled once nothing is unfinished', await b.evaluate(`!document.querySelector('[data-testid=close-fieldwork]')?.disabled`))
  await b.evaluate(`document.querySelector('[data-testid=close-fieldwork]').click(); true`); await b.sleep(400)
  await b.evaluate(`document.querySelector('[data-testid=confirm-close]').click(); true`); await b.sleep(800)
  const closedPage = await b.evaluate(T)
  ok('Closing makes the study Complete and says who closed it', /Complete Release/.test(closedPage) && /Closed by Maya Ortiz/.test(closedPage), closedPage.slice(0, 300))
  ok('and the days-left card reads Closed', /Days left Closed /.test(closedPage), closedPage.slice(0, 300))
  await b.shot('s2-closed')

  // Analysis stays locked until every session has a Review decision, then opens.
  ok('Analysis is still locked while sessions are undecided', !!(await lockReason()), String(await lockReason()))
  await jump(async () => { await b.evaluate(`__click('Dev demo: decide every session')`); await b.sleep(600) })
  await b.goto(root + '/review/queue'); await b.waitFor('Completed interviews'); await b.sleep(800)
  ok('Analysis unlocks once every session has a decision', !(await lockReason()), String(await lockReason()))
  ok('invariants hold at the end', !(await b.evaluate('window.__invariants'))?.length)
  await b.shot('s2-analysis-open')
  console.log(JSON.stringify({ s0, s1, s2, s3, s4, s5, s6 }, (k, v) => (k === 'invariants' ? undefined : v)))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(failures.length ? 'STAGE2 FAILED:\n - ' + failures.join('\n - ') : 'STAGE2 OK')
if (failures.length) process.exitCode = 1
