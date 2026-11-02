// Participant journey: the numbers, the biggest-loss arrow, and what each link opens in Sessions.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept/fieldwork/command-center'
const out = {}
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.goto(root); await b.waitFor('Participant journey'); await b.sleep(700)
  out.tiles = await b.evaluate(`[...document.querySelectorAll('[data-testid^=journey-][aria-label]')].map(e=>e.getAttribute('aria-label'))`)
  out.biggest = await b.evaluate(`document.querySelector('[data-biggest=true]')?.dataset.testid`)
  out.reading = await b.evaluate(`document.querySelector('[data-testid=journey-reading]').innerText`)
  out.subNotes = await b.evaluate(`document.body.innerText.includes('no-show, slot held') || document.body.innerText.includes('technical error')`)
  for (const id of ['journey-step-opened', 'journey-started', 'journey-step-invited']) {
    await b.goto(root); await b.waitFor('Participant journey'); await b.sleep(500)
    await b.evaluate(`document.querySelector('[data-testid=${id}]').click(); true`); await b.sleep(900)
    out[id] = [await b.evaluate(`location.search`), await b.evaluate(`document.querySelector('[data-testid=journey-filter]')?.innerText.replace(/\\s+/g,' ')`), await b.evaluate(`[...document.querySelectorAll('#fw-panel tbody tr')].map(r=>r.querySelector('td')?.innerText.trim()).join(' ')`)]
  }
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
