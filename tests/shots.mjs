// Screenshots of the screens whose numbers must agree: node tests/shots.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  for (const [name, path, wait] of [['s1-r18', '/fieldwork/command-center', 'Fieldwork command center'], ['s1-r21', '/review/queue', 'Completed interviews']]) {
    await b.goto(root + path); await b.waitFor(wait); await b.sleep(1200); await b.shot(name, true)
  }
} finally { b.close() }
