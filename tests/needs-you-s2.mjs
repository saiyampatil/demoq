// Needs you, what must not appear: self-fixed and PulseAI-handled issues stay in the Issues tab, accepted escalations stay in Sessions.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const out = {}
const needsText = `document.querySelector('#needs-you')?.innerText.replace(/\\s+/g,' ')`
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.goto(root + '/fieldwork/command-center?tab=issues'); await b.waitFor('Issue log'); await b.sleep(700)
  out.issueTiles = await b.evaluate(`document.querySelector('[aria-label="Issue summary"]').innerText.replace(/\\s+/g,' ')`)
  out.handlingLabel = await b.evaluate(`document.body.innerText.includes('PulseAI is handling this')`)
  await b.shot('needs-you-s2-issues', false)
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(900)
  const t = await b.evaluate(needsText)
  out.selfFixedParticipants = ['P-2051', 'P-2052', 'P-2047'].filter((p) => t.includes(p))
  out.completedInNeeds = ['P-2041', 'P-2043', 'P-2054'].filter((p) => t.includes(p))
  out.inProgressInNeeds = t.includes('P-2042')
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
