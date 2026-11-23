// Emotion & behaviour (A2): the page name and coverage, the tension made from emotion, and the count on a tension theme. Every step waits on state and every expectation is asserted.
//   npx vite --port 5199 --strictPort &   then   node tests/emotion.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail ? `${label} (${detail})` : label)
}
const text = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const click = async (sel) => {
  const done = await b.poll(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel}`)
  await b.sleep(350)
}
const clickText = async (sel, label) => {
  const done = await b.poll(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.innerText.trim().replace(/\\s+/g,' ').startsWith(${JSON.stringify(label)}));if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel} "${label}"`)
  await b.sleep(350)
}
const fresh = async () => {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto(`${root}/signals?view=code`)
  await b.waitFor('Emotion & behaviour'); await b.waitFor('What stood out'); await b.sleep(500)
}
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
const selectCode = async (name) => { await clickText('[data-testid=signal-row]', name); await b.sleep(300) }

try {
  await fresh()
  const page = await text('main')
  ok('step is named Emotion & behaviour', /Emotion & behaviour/.test(page ?? ''))
  ok('the old step name is gone from the header', !/Signals & tensions/.test(page ?? ''))
  ok('the coverage line says speech was read for everyone and who was audio-only', /Speech read for \d+ of \d+ · \d+ audio-only, read on speech/.test((await text('[data-testid=coverage]')) ?? ''), await text('[data-testid=coverage]'))
  // The Signals-page checks that used to sit here (Face and Speech columns, face states on rows, the face and words channels in the code panel,
  // correcting a face reading, the face-reading filter on the log) tested faces on the Themes tab. Faces no longer show there or feed a verdict.

  // ── Tensions: the new kind, faces on clips, the right numbers ──
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
  await clickText('[data-testid=tf-All]', 'All'); await b.sleep(300)
  const cards = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card]')].map(c=>c.innerText.replace(/\\s+/g,' '))`)
  const face = cards.find((c) => /Said vs emotion/.test(c))
  ok('there is a Said vs emotion tension about pause and portions', !!face && /portion-matched boxes/.test(face), cards.map((c) => c.slice(0, 50)).join(' | '))
  const sides = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card]')].find(c=>/Said vs emotion/.test(c.innerText)).querySelector('[data-testid=tension-sides]').innerText.replace(/\\s+/g,' ')`)
  ok('its sides are in n of N, and name who had no face', /\d+ of 6/.test(sides) && /of 2|of 4|of 3|of 5/.test(sides) && /audio-only/i.test(sides), sides)
  ok('its clips show the face at Concept A and at Concept C', await b.evaluate(`(()=>{const c=[...document.querySelectorAll('[data-testid=tension-card]')].find(c=>/Said vs emotion/.test(c.innerText));const f=c.querySelector('[data-testid=clip-faces]');return !!f&&/Concept A/.test(f.innerText)&&/Concept C/.test(f.innerText)})()`))
  await b.shot('emo-a2-tensions')

  // ── A tension theme counts the tension's own finding ──
  await clickText('[data-testid=tension-card] button', 'Add as a tension theme')
  await b.evaluate(`document.querySelector('[data-testid=turn-theme]')?.click(); true`); await b.sleep(400)
  const opened = await b.evaluate(`!!document.querySelector('[data-testid=turn-confirm]')`)
  ok('Add as a tension theme opens the dialog', opened)
  if (opened) {
    await click('[data-testid=turn-confirm]')
    await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(500)
    const th = await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-card]')].filter(c=>c.dataset.fromTension==='true').map(c=>c.innerText.replace(/\\s+/g,' '))`)
    ok('the theme made from the tension shows its own count, not everyone who said the code', th.length >= 1 && th.every((t) => /of \d+ people/.test(t) && !/of 20 people/.test(t)), th.join(' | '))
    await b.shot('emo-themes-tension')
  }

  // ── The way on ──
  await b.goto(`${root}/signals?view=code`); await b.waitFor('What stood out'); await b.sleep(400)
  const foot = await text('main')
  ok('the stepper names the step', /Emotion & behaviour/.test(foot ?? ''))
  ok('invariants hold', !(await b.evaluate('window.__invariants'))?.length)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('EMOTION FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('EMOTION OK')
