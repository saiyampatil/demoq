// Needs you: which rows the seed shows, the actions on each, the dev controls, and a screenshot.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const shotName = process.argv[2] || 'needs-you'
const rows = `[...document.querySelectorAll('#needs-you ul > li')].map(l=>l.innerText.replace(/\\s+/g,' ').trim())`
const out = {}
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(900)
  out.header = await b.evaluate(`document.querySelector('#needs-you h2').innerText.replace(/\\s+/g,' ')`)
  out.rows = await b.evaluate(rows)
  out.buttons = await b.evaluate(`[...document.querySelectorAll('#needs-you ul > li')].map(l=>l.innerText.split(/\\s{2,}|\\n/)[0]+' => '+[...l.querySelectorAll('button')].map(x=>x.innerText.trim()).join(' | '))`)
  out.inv = await b.evaluate(`window.__invariants`)
  await b.evaluate(`document.getElementById('needs-you').scrollIntoView({block:'start'}); true`); await b.sleep(300)
  await b.shot(shotName, false)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
