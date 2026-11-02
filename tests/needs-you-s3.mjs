// Needs you, grace periods: what shows at the seed time and after each step of simulated time.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const out = {}
const list = `[...document.querySelectorAll('#needs-you ul > li')].map(l=>{const t=l.innerText.replace(/\\s+/g,' ').trim();return t.slice(0,95)})`
const count = `document.querySelector('#needs-you h2').innerText.replace(/\\s+/g,' ')`
const step = async (label) => { await b.evaluate(`[...document.querySelectorAll('[data-testid=needs-dev] button')].find(x=>x.innerText.trim()===${JSON.stringify(label)}).click(); true`); await b.sleep(500) }
const showAll = async () => { await b.evaluate(`[...document.querySelectorAll('#needs-you button')].find(x=>/^Show all/.test(x.innerText.trim()))?.click(); true`); await b.sleep(250) }
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(900)
  out['seed'] = [await b.evaluate(count), await b.evaluate(list)]
  await step('+15 min'); out['+15 min'] = [await b.evaluate(count)]
  await step('+30 min'); out['+45 min total'] = [await b.evaluate(count)]
  await step('+2 h'); await showAll(); out['+2h45 total'] = [await b.evaluate(count), await b.evaluate(list)]
  await b.evaluate(`document.getElementById('needs-you').scrollIntoView({block:'start'}); true`); await b.sleep(300); await b.shot('needs-you-s3')
  await step('+24 h'); await showAll(); out['+26h45 total'] = [await b.evaluate(count), await b.evaluate(list)]
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
