// Fieldwork to Review: simulate an Active session completing, then check every count moved together.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.goto(root + '/fieldwork/command-center?tab=sessions'); await b.waitFor('Consent log'); await b.sleep(500)
  const active = await b.evaluate(`[...document.querySelectorAll('#fw-panel tbody tr')].find(r=>/Active/.test(r.innerText))?.querySelector('a, td')?.innerText.trim().split('\\n')[0]`)
  console.log('active session:', active)
  const sid = active.replace(/\\s+/g,'').slice(0,6) + '-1'
  await b.goto(`${root}/fieldwork/sessions/${sid}`); await b.waitFor('Simulate: session completes'); await b.sleep(400)
  await b.evaluate(`__click('Simulate: session completes')`); await b.sleep(600)
  console.log('R19 message:', await b.evaluate(`document.querySelector('[data-testid=simulated]')?.innerText`))
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Fieldwork command center'); await b.sleep(1200)
  console.log('R18 header:', (await b.evaluate(T)).match(/\d+ confirmed, \d+ pending review, \d+ of \d+ toward target/)?.[0])
  console.log('Funnel line:', (await b.evaluate(T)).match(/\d+ invited = [^.]*\./)?.[0])
  await b.goto(root + '/review/queue'); await b.waitFor('Completed interviews'); await b.sleep(1200)
  console.log('R21 cards:', await b.evaluate(`document.querySelector('section[aria-label=Summary]')?.innerText.replace(/\\s+/g,' ')`))
  console.log('R21 row:', await b.evaluate(`[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes(${JSON.stringify(sid.slice(0,6))}))?.innerText.replace(/\\s+/g,' ')`))
  console.log('badge:', await b.evaluate(`document.body.innerText.match(/Review\\s+\\d+ awaiting/)?.[0].replace(/\\s+/g,' ')`))
  await b.goto(`${root}/review/session/${sid}`); await b.waitFor('Session'); await b.sleep(1500)
  console.log('R22:', (await b.evaluate(T)).slice(0, 500))
  await b.shot('bridge-r22')
  console.log('INVARIANT VIOLATIONS:', JSON.stringify(await b.evaluate(`window.__invariants`)))
} finally { b.close() }
