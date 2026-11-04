// Fieldwork command center screenshots at 1440 and 1024: node tests/fw-shots.mjs <prefix> <overview-risk|overview-ontrack|sessions|issues|reserve> ...
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept/fieldwork/command-center'
const [prefix, ...views] = process.argv.slice(2)
const out = {}
const live = async () => {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
}
const lowerTarget = async () => {
  await b.evaluate(`(()=>{const k='pulseai-qual:v2';const s=JSON.parse(localStorage.getItem(k));s.fieldworks['moisturizer-concept'].targetChange={from:24,to:20,by:'Maya Ortiz',at:'2026-11-11T17:00:00-05:00',reason:'Dev demo for an On track screenshot'};localStorage.setItem(k,JSON.stringify(s));return true})()`)
}
const snap = async (name, url) => {
  for (const w of [1440, 1024]) {
    await b.viewport(w, 1000); await b.goto(url); await b.sleep(1400)
    out[`${name}-${w}-overflow`] = await b.evaluate(`[document.documentElement.scrollWidth, innerWidth]`)
    await b.shot(`${prefix}-${name}-${w}`, true)
  }
}
try {
  await live()
  for (const v of views) {
    if (v === 'overview-risk') await snap('overview-risk', root)
    if (v === 'overview-ontrack') { await lowerTarget(); await snap('overview-ontrack', root); await live() }
    if (v === 'sessions') await snap('sessions', root + '?tab=sessions')
    if (v === 'reserve') await snap('reserve', root + '?tab=reserve')
  }
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
