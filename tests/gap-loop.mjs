// R18, closing the gap: the verdict, the one way to fill it (the reserve), and the time check with Extend window / Lower target.
// "Source more", the top-up card and "new in reserve" were removed on purpose (docs/DECISIONS.md, "no sourcing, coverage, activity or
// top-up status"), so they are not tested. Every expectation is asserted.
//   npx vite --port 5199 --strictPort &   then   node tests/gap-loop.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const failures = []
const ok = (label, cond, detail) => { if (!cond) failures.push(detail ? `${label} (${detail})` : label) }
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
const overview = async () => {
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Fieldwork command center'); await b.sleep(1000)
  return {
    level: await b.evaluate(`document.querySelector('[aria-label=Verdict]')?.dataset.level ?? null`),
    sentence: await b.evaluate(`document.querySelector('[data-testid=verdict-sentence]')?.innerText ?? null`),
    buttons: await b.evaluate(`[...document.querySelectorAll('[aria-label="Verdict actions"] button, [aria-label="Verdict actions"] a')].map(x=>x.innerText.trim())`),
    timeCheck: await b.evaluate(`document.querySelector('[data-testid=not-enough-time]')?.innerText.replace(/\\s+/g,' ') ?? null`),
    topUp: await b.evaluate(`!!document.querySelector('[data-testid=topup-card],[data-testid=new-in-reserve]')`),
    target: await b.evaluate(`document.querySelector('main').innerText.replace(/\\s+/g,' ').match(/Toward target (\\d+ of \\d+)/)?.[1] ?? null`),
  }
}
const exclude = async (sid) => {
  await b.goto(`${root}/review/session/${sid}`); await b.waitFor('Decision'); await b.sleep(1000)
  await b.evaluate(`__click('Exclude')`); await b.sleep(400)
  await b.evaluate(`document.querySelector('[role=dialog] input[type=checkbox]').click(); true`); await b.sleep(200)
  await b.evaluate(`__click('Exclude session')`); await b.sleep(500)
}
const screenJump = async (label) => {
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`__click(${JSON.stringify(label)})`); await b.sleep(400)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`); await b.sleep(300)
}
const adjust = async (button, reason) => {
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor(button); await b.sleep(500)
  await b.evaluate(`__click(${JSON.stringify(button)})`); await b.sleep(400)
  const needsReason = await b.evaluate(`document.querySelector('[data-testid=confirm-adjust]').disabled`)
  await b.evaluate(setText('[role=dialog] textarea', reason)); await b.sleep(300)
  await b.evaluate(`document.querySelector('[data-testid=confirm-adjust]').click(); true`); await b.sleep(600)
  return needsReason
}
const gapOf = (s) => Number((String(s?.sentence ?? '').match(/^(\d+) more/) ?? [])[1])
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`)

  const seed = await overview()
  ok('seed: the verdict is At risk', seed.level === 'At risk', seed.level)
  ok('seed: it says how many more people are needed', gapOf(seed) === 2, seed.sentence)
  ok('seed: with an empty reserve the one action is Open the reserve', seed.buttons.length === 1 && seed.buttons[0] === 'Open the reserve', seed.buttons.join(' / '))
  ok('no top-up card or "new in reserve" line (removed on purpose)', !seed.topUp)
  ok('no time warning with plenty of time left', seed.timeCheck === null, seed.timeCheck)

  await exclude('P-2055-1')
  const excluded = await overview()
  ok('excluding a session grows the gap by one', gapOf(excluded) === gapOf(seed) + 1, `${seed.sentence} -> ${excluded.sentence}`)
  ok('and the reserve is still the way to fill it', excluded.buttons.includes('Open the reserve'), excluded.buttons.join(' / '))
  await b.shot('g1-no-reserve')

  await screenJump('2 days left')
  const short = await overview()
  ok('with 2 days left and a gap, it warns there is not enough time', !!short.timeCheck && /Not enough time left/.test(short.timeCheck), short.timeCheck)
  await b.shot('g1-time')

  const mustGiveReason = await adjust('Extend window', 'Panel is slow to respond.')
  ok('Extend window needs a reason', mustGiveReason === true)
  const extended = await overview()
  ok('after extending, the time warning is gone', extended.timeCheck === null, extended.timeCheck)
  ok('extending does not change the gap or the target', gapOf(extended) === gapOf(excluded) && extended.target === excluded.target, `${excluded.target} ${excluded.sentence} -> ${extended.target} ${extended.sentence}`)

  await screenJump('2 days left')
  const mustGiveReason2 = await adjust('Lower target', 'Client agreed to a smaller sample.')
  ok('Lower target needs a reason', mustGiveReason2 === true)
  const lowered = await overview()
  const [, tgtBefore] = String(excluded.target).split(' of ').map(Number)
  const [, tgtAfter] = String(lowered.target).split(' of ').map(Number)
  ok('lowering the target makes it smaller', tgtAfter < tgtBefore, `${excluded.target} -> ${lowered.target}`)
  ok('and closes the gap by the same amount', gapOf(lowered) === gapOf(excluded) - (tgtBefore - tgtAfter) || lowered.level !== 'At risk', `${excluded.sentence} -> ${lowered.sentence} (${lowered.level})`)

  ok('invariants hold', !(await b.evaluate('window.__invariants'))?.length)
  console.log(JSON.stringify({ seed, excluded, short, extended, lowered }, null, 1))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(failures.length ? 'GAP-LOOP FAILED:\n - ' + failures.join('\n - ') : 'GAP-LOOP OK')
if (failures.length) process.exitCode = 1
