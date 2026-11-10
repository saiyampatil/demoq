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
  // The Issues tab is gone on purpose (CommandCenter sends an old ?tab=issues link to the Overview), so there is no issue log to read.
  await b.goto(root + '/fieldwork/command-center?tab=issues'); await b.waitFor('Needs you'); await b.sleep(700)
  out.oldIssuesLinkLandsOnOverview = await b.evaluate(`!location.search.includes('tab=issues')&&!!document.querySelector('#needs-you')`)
  // Only five rows show at first, so open them all or a wrong row hiding at the end would pass.
  await b.evaluate(`[...document.querySelectorAll('#needs-you button')].find(x=>/^Show all/.test(x.innerText.trim()))?.click(); true`); await b.sleep(300)
  const t = await b.evaluate(needsText)
  // P-2051 and P-2052 had an issue that was fixed (camera, consent) and are fine. P-2047 also had a fixed issue (audio), but it
  // since left part-way and hasn't come back, which is a reason in its own right (docs/OPEN_QUESTIONS.md #73). So it is in, for that reason only.
  out.selfFixedParticipants = ['P-2051', 'P-2052'].filter((p) => t.includes(p))
  out.p2047Row = await b.evaluate(`[...document.querySelectorAll('#needs-you ul > li')].find(l=>l.innerText.includes('P-2047'))?.innerText.replace(/\\s+/g,' ')`)
  out.completedInNeeds = ['P-2041', 'P-2043', 'P-2054'].filter((p) => t.includes(p))
  out.inProgressInNeeds = t.includes('P-2042')
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
  const bad = []
  if (!out.oldIssuesLinkLandsOnOverview) bad.push('an old Issues link should land on the Overview')
  if (out.selfFixedParticipants.length) bad.push('self-fixed issues are in Needs you: ' + out.selfFixedParticipants)
  if (!/Left part-way/.test(out.p2047Row ?? '') || /Audio dropped/.test(out.p2047Row ?? '')) bad.push('P-2047 should be in Needs you for leaving part-way, not for its fixed audio issue')
  if (out.completedInNeeds.length) bad.push('completed sessions are in Needs you: ' + out.completedInNeeds)
  if (out.inProgressInNeeds) bad.push('a session still in progress is in Needs you')
  if (out.inv?.length) bad.push('invariant violations')
  console.log(bad.length ? 'NEEDS-YOU S2 FAILED: ' + bad.join('; ') : 'NEEDS-YOU S2 OK')
  if (bad.length) process.exitCode = 1
} finally { b.close() }
