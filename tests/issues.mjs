// R18/R19, issue ownership: an issue ends from the next event (the participant opens the link, resumes, PulseAI recovers), or with a
// reason, or when the Researcher gives up on the participant. There is no "Mark resolved". The Issues tab is gone on purpose, so
// this reads each issue where it lives now, on the session page. Every expectation is asserted.
//   npx vite --port 5199 --strictPort &   then   node tests/issues.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const failures = []
const ok = (label, cond, detail) => { if (!cond) failures.push(detail ? `${label} (${detail})` : label) }
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
const fresh = async () => {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
}
const r19 = async (sid) => {
  await b.goto(`${root}/fieldwork/sessions/${sid}`)
  try { if (!(await b.poll(`/R19\\s+Session/.test(document.body.innerText)`, 8000))) throw new Error('no header') } catch { throw new Error(`the session page for ${sid} did not open. It shows: ${(await b.evaluate(`document.querySelector('main')?.innerText.replace(/\\s+/g,' ').slice(0,300)`))}`) }
  await b.sleep(600)
}
const issue = (type) => b.evaluate(`(() => { const li=[...document.querySelectorAll('main li')].find(l=>l.innerText.startsWith(${JSON.stringify(type)})); return li?.innerText.replace(/\\s+/g,' ') ?? null })()`)
const isOpen = (t) => !!t && /\bOpen\b/.test(t) && !/Resolved/.test(t)
const isResolved = (t) => !!t && /Resolved/.test(t)
// What stands in for the participant and PulseAI lives in the Screen jump panel on a session page: open it, act, close it.
const dev = async (how) => {
  await b.evaluate(`document.querySelector('[role=dialog]') || __click('Screen jump'); true`); await b.sleep(250)
  const done = await b.poll(`(()=>{const e=${how};if(!e||e.disabled)return false;e.click();return true})()`)
  await b.sleep(450)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`); await b.sleep(250)
  return !!done
}
const devText = (text) => dev(`[...document.querySelectorAll('[role=dialog] button')].find(x=>x.innerText.trim()===${JSON.stringify(text)})`)
const needsClick = async (who, action) => {
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(700)
  await b.evaluate(`[...document.querySelectorAll('#needs-you button')].find(x=>/^Show all/.test(x.innerText.trim()))?.click(); true`); await b.sleep(200)
  const clicked = await b.evaluate(`(() => { const row=[...document.querySelectorAll('#needs-you li')].find(l=>l.innerText.includes(${JSON.stringify(who)})); const btn=row&&[...row.querySelectorAll('button')].find(x=>x.innerText.trim()===${JSON.stringify(action)}); if(!btn||btn.disabled) return false; btn.click(); return true })()`)
  await b.sleep(500)
  return clicked
}
try {
  await fresh()
  ok('nothing says Mark resolved', !(await b.evaluate(`document.body.innerText.includes('Mark resolved')`)))

  // Mic denied: resend the link. The issue stays open and ends when the participant's session starts.
  ok('P-2061: Resend link is offered', await needsClick('P-2061', 'Resend link'))
  await r19('P-2061-1')
  ok('P-2061: still open after the link is resent', isOpen(await issue('Microphone permission denied')), await issue('Microphone permission denied'))
  await devText('Simulate: participant opens their link')
  await devText('Simulate: participant opens their link').catch(() => {})
  ok('P-2061: resolved once the participant opened the link and started', isResolved(await issue('Microphone permission denied')), await issue('Microphone permission denied'))

  // Link expired: reissue. It ends when the reissued link is opened.
  ok('P-2065: Reissue link is offered', await needsClick('P-2065', 'Reissue link'))
  await r19('P-2065-1')
  ok('P-2065: still open after the link is reissued', isOpen(await issue('Link expired or invalid')), await issue('Link expired or invalid'))
  await devText('Simulate: participant opens their link')
  ok('P-2065: resolved when the reissued link is opened', isResolved(await issue('Link expired or invalid')), await issue('Link expired or invalid'))

  // Connection lost: retry. It ends when the participant resumes in the new session.
  ok('P-2048: Retry is offered', await needsClick('P-2048', 'Retry'))
  await r19('P-2048-1')
  ok('P-2048: still open after a retry', isOpen(await issue('Connection lost')), await issue('Connection lost'))
  await r19('P-2048-2'); await devText('Simulate: participant resumes')
  await r19('P-2048-1')
  ok('P-2048: resolved once the participant resumed', isResolved(await issue('Connection lost')), await issue('Connection lost'))

  // PulseAI is handling this: no Researcher action, and no way to close it. It ends when PulseAI recovers.
  await r19('P-2042-1')
  ok('P-2042: open, with no close button (the Researcher can’t close PulseAI’s own failure)', isOpen(await issue('Transcription delayed')) && !(await b.evaluate(`!!document.querySelector('[data-testid=close-without-fix]')`)))
  ok('P-2042: PulseAI is handling this is said', await b.evaluate(`document.body.innerText.includes('PulseAI is handling this')`))
  ok('P-2042: PulseAI recovers', await dev(`document.querySelector('[data-testid=simulate-recover]')`))
  ok('P-2042: resolved once PulseAI recovered', isResolved(await issue('Transcription delayed')), await issue('Transcription delayed'))
  ok('invariants hold', !(await b.evaluate('window.__invariants'))?.length)

  // Manual closing: only with a reason, or by giving up.
  await fresh()
  await r19('P-2061-1')
  await b.evaluate(`document.querySelector('[data-testid=close-without-fix]').click(); true`); await b.sleep(400)
  ok('close without a fix needs a reason', await b.evaluate(`document.querySelector('[data-testid=confirm-close-without-fix]').disabled`))
  await b.evaluate(setText('[role=dialog] textarea', 'Participant says they will not retry.')); await b.sleep(300)
  await b.evaluate(`document.querySelector('[data-testid=confirm-close-without-fix]').click(); true`); await b.sleep(500)
  const closed = await issue('Microphone permission denied')
  ok('closing with a reason resolves it and says it had no fix', isResolved(closed) && /without a fix/.test(closed), closed)
  ok('the reason and who closed it are kept on the session', await b.evaluate(`/Participant says they will not retry/.test(document.querySelector('main').innerText)`))

  ok('P-2065: Give up and replace is offered', await needsClick('P-2065', 'Give up and replace'))
  await b.sleep(300)
  await b.evaluate(setText('[role=dialog] textarea', 'Unreachable.')); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].filter(x=>/Give up/.test(x.innerText)).pop().click(); true`); await b.sleep(500)
  await r19('P-2065-1')
  const gaveUp = await issue('Link expired or invalid')
  ok('giving up ends the participant’s open issue', !isOpen(gaveUp), gaveUp)
  ok('and the session says it was given up', await b.evaluate(`/Given up/.test(document.querySelector('main').innerText)`))
  ok('invariants hold after giving up', !(await b.evaluate('window.__invariants'))?.length)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(failures.length ? 'ISSUES FAILED:\n - ' + failures.join('\n - ') : 'ISSUES OK')
if (failures.length) process.exitCode = 1
