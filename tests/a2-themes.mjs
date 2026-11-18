// A2 tension themes: they are managed in the Tensions tab, and the Signals tab no longer lists them (only the footer counts them).
//   the wording, Restore and dismiss, and that nothing about them is left in the Signals table.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-themes.mjs
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
const all = (sel) => b.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>e.innerText.replace(/\\s+/g,' '))`)
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
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
// Modules are imported by the exact URL the app loaded (the dev server adds ?t= after an edit), so they are the app's own instances.
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
const fresh = async () => {
  await b.goto('/researcher')
  await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals`)
  await b.waitFor('Words vs delivery')
  await b.sleep(500)
  // The seed has one approved tension (for the audio summary). These checks start with none, so it is put back to review first.
  await b.evaluate(`window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts'); (async()=>{const cb=await window.__mod('/src/state/codebook'); cb.updateCodebook('pet-food-churn', d=>cb.restoreTension(d,{id:'tn-pause-concept',title:'t'},{by:'test'})); return true})()`); await b.sleep(600)
}
const acceptAllThemes = async () => {
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(500)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-suggestion]')].forEach(s=>s.querySelector('[data-testid=accept-theme]').click()); true`)
  await b.sleep(600)
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(500)
}

try {
  // ── Tension themes: the wording, the footer count, Restore ──
  await fresh()
  await acceptAllThemes()
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
  const btn = await b.evaluate(`document.querySelector('[data-testid=turn-theme]')?.innerText.trim()`)
  ok('the button says Add as a tension theme', btn === 'Add as a tension theme', btn)
  ok('nothing says “Turn into a theme” any more', !/Turn into a theme|Turned into a theme/.test((await text('main')) ?? ''))
  const tTitle = await b.evaluate(`document.querySelector('[data-testid=tension-card][data-status=Suggested] h3').innerText.trim()`)
  await click('[data-testid=turn-theme]')
  await click('[data-testid=turn-confirm]')
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(600)
  ok('the Signals table has no Tension themes group or heading; the footer counts the tension theme', (await b.evaluate(`document.querySelectorAll('[data-testid=tension-theme-list],#tension-themes').length`)) === 0 && !(await b.evaluate(`[...document.querySelectorAll('h3')].some(h=>/Tension themes/.test(h.innerText))`)) && /and 1 tension theme\./.test((await text('[data-testid=report-footer-count]')) ?? ''), await text('[data-testid=report-footer-count]'))
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(400)
  ok('the Themes tab calls it a tension theme', await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-card][data-from-tension=true]')].every(c=>/Tension theme/.test(c.innerText))&&document.querySelectorAll('[data-testid=theme-card][data-from-tension=true]').length===1`))
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
  await clickText('[data-testid=tf-All]', 'All'); await b.sleep(300)
  const addedCard = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card][data-status="Added as a tension theme"]')].map(c=>c.innerText.replace(/\\s+/g,' '))`)
  ok('an added tension shows Tension theme … added by, and a Restore button', addedCard.length === 1 && /Tension theme “.+” added by/.test(addedCard[0]) && /Restore/.test(addedCard[0]), addedCard[0])
  await b.evaluate(`document.querySelector('[data-testid=tension-card][data-status="Added as a tension theme"] [data-testid=restore-tension]').click(); true`); await b.sleep(500)
  ok('Restore puts the tension back to review', (await b.evaluate(`document.querySelectorAll('[data-testid=tension-card][data-status="Added as a tension theme"]').length`)) === 0 && (await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card][data-status=Suggested]')].some(c=>c.innerText.includes(${JSON.stringify(tTitle.slice(0, 30))}))`)))
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(500)
  ok('and the footer no longer counts it', /and 0 tension themes\./.test((await text('[data-testid=report-footer-count]')) ?? ''), await text('[data-testid=report-footer-count]'))
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
  await clickText('[data-testid=tf-Dismissed]', 'Dismissed'); await b.sleep(300)
  const dismissedCard = await b.evaluate(`!!document.querySelector('[data-testid=tension-card][data-status=Dismissed] [data-testid=restore-tension]')`)
  ok('a dismissed tension has Restore', dismissedCard)
  await clickText('[data-testid=tf-Suggested]', 'To review'); await b.sleep(300)
  await click('[data-testid=dismiss-tension]')
  ok('dismissing still asks for a reason', await b.evaluate(`document.querySelector('[data-testid=reason-confirm]').disabled`))
  await b.evaluate(setText('[role=dialog] textarea', 'Too few people.')); await b.sleep(250)
  await click('[data-testid=reason-confirm]')
  await clickText('[data-testid=tf-Dismissed]', 'Dismissed'); await b.sleep(300)
  ok('and the dismissed one can be restored', (await b.evaluate(`document.querySelectorAll('[data-testid=tension-card][data-status=Dismissed] [data-testid=restore-tension]').length`)) >= 2)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 THEMES FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A2 THEMES OK')
