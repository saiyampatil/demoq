// Issues tab: the three cards, the table, and what View N and Need your action open.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept/fieldwork/command-center'
const out = {}
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.goto(root + '?tab=issues'); await b.waitFor('What has happened'); await b.sleep(600)
  out.cards = await b.evaluate(`document.querySelector('[aria-label="Issue summary"]').innerText.replace(/\\s+/g,' ')`)
  out.typesShown = await b.evaluate(`document.querySelectorAll('[data-testid=issue-types] tbody tr').length`)
  out.firstRows = await b.evaluate(`[...document.querySelectorAll('[data-testid=issue-types] tbody tr')].slice(0,5).map(r=>r.innerText.replace(/\\s+/g,' '))`)
  out.logOptions = await b.evaluate(`[...document.querySelectorAll('select option')].map(o=>o.innerText)`)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=issue-types] a')][0].click(); true`); await b.sleep(900)
  out.viewUrl = await b.evaluate(`decodeURIComponent(location.search)`)
  out.viewChip = await b.evaluate(`document.querySelector('[data-testid=issue-filter]')?.innerText.replace(/\\s+/g,' ')`)
  out.viewRows = await b.evaluate(`[...document.querySelectorAll('#fw-panel tbody tr')].map(r=>r.querySelector('td')?.innerText.trim()).join(' ')`)
  await b.goto(root + '?tab=issues'); await b.waitFor('What has happened'); await b.sleep(500)
  await b.evaluate(`document.querySelector('[data-testid=issues-need-action]').click(); true`); await b.sleep(1000)
  out.needsUrl = await b.evaluate(`location.pathname+location.search+location.hash`)
  out.needsInView = await b.evaluate(`(()=>{const r=document.getElementById('needs-you').getBoundingClientRect();return r.top>=0&&r.top<400})()`)
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
