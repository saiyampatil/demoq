// Setup-flow probes (R8 reward, R9/R10, R11, R12, R15). node tests/setup-flow.mjs <prefix> <scenario>
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const [prefix, scenario] = process.argv.slice(2)
const out = {}
const key = 'pulseai-qual:v2'
const stage = async (label) => {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)})).click(); true`); await b.sleep(500)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`)
}
/** Edit the saved app state in place, then reload so the app reads it. */
const mutate = async (fnSrc) => {
  await b.evaluate(`(()=>{const k=${JSON.stringify(key)};const s=JSON.parse(localStorage.getItem(k));(${fnSrc})(s);localStorage.setItem(k,JSON.stringify(s));return true})()`)
}
const open = async (path, w = 1440) => { await b.viewport(w, 1000); await b.goto(root + path); await b.sleep(900) }
const text = () => b.evaluate('document.body.innerText')
try {
  const sc = { b, out, stage, mutate, open, text, root, prefix }
  const mod = await import(`./scenarios/${scenario}.mjs`)
  await mod.default(sc)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
