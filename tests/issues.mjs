// R18 stage 2, issue ownership: issues end from the next event or with a reason, never from "Mark resolved".
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
const fresh = async () => {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
}
const issuesTab = async (label, status = 'Open') => {
  await b.goto(root + '/fieldwork/command-center?tab=issues'); await b.waitFor('Issue log'); await b.sleep(700)
  console.log(`[Issues tab: ${label}]`)
  console.log('   Mark resolved anywhere?', await b.evaluate(`document.body.innerText.includes('Mark resolved')`), '| buttons in log:', await b.evaluate(`document.querySelectorAll('#fw-panel ul button').length`))
  console.log('   open:', await b.evaluate(`[...document.querySelectorAll('#fw-panel ul li')].filter(l=>/\\bOpen$/.test(l.innerText.trim())).map(l=>l.innerText.replace(/\\s+/g,' ').slice(0,150)).join('\\n         ')`))
}
const r19 = async (sid) => { await b.goto(`${root}/fieldwork/sessions/${sid}`); await b.waitFor('Technical issues'); await b.sleep(700) }
const issueText = (type) => `(() => { const li=[...document.querySelectorAll('main li')].find(l=>l.innerText.startsWith(${JSON.stringify(type)})); return li?.innerText.replace(/\\s+/g,' ') })()`
const needsClick = async (who, action) => { await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(800); await b.evaluate(`(() => { const row=[...document.querySelectorAll('#needs-you li')].find(l=>l.innerText.includes(${JSON.stringify(who)})); [...row.querySelectorAll('button')].find(x=>x.innerText.trim()===${JSON.stringify(action)}).click(); return true })()`); await b.sleep(500) }
try {
  await fresh()
  await issuesTab('seed')
  // Mic denied: resend the link, issue stays open, resolves when the participant's session starts.
  await needsClick('P-2061', 'Resend link')
  await r19('P-2061-1'); console.log('P-2061 after resend:', await b.evaluate(issueText('Microphone permission denied')))
  await b.evaluate(`__click('Simulate: participant opens their link')`); await b.sleep(500)
  await b.evaluate(`__click('Simulate: participant opens their link')`).catch(() => {}); await b.sleep(500)
  console.log('P-2061 after link opened and session started:', await b.evaluate(issueText('Microphone permission denied')))
  // Link expired: reissue, resolves when the reissued link is opened.
  await needsClick('P-2065', 'Reissue link')
  await r19('P-2065-1'); console.log('P-2065 after reissue:', await b.evaluate(issueText('Link expired or invalid')))
  await b.evaluate(`__click('Simulate: participant opens their link')`); await b.sleep(500)
  console.log('P-2065 after reissued link opened:', await b.evaluate(issueText('Link expired or invalid')))
  // Connection lost: retry, resolves when the participant resumes in the new session.
  await needsClick('P-2048', 'Retry')
  await r19('P-2048-1'); console.log('P-2048-1 after retry:', await b.evaluate(issueText('Connection lost')))
  await r19('P-2048-2'); await b.evaluate(`__click('Simulate: participant resumes')`); await b.sleep(500)
  await r19('P-2048-1'); console.log('P-2048-1 after the participant resumed:', await b.evaluate(issueText('Connection lost')))
  // System: PulseAI is handling this. No Researcher action; resolves when it recovers.
  await r19('P-2042-1'); console.log('P-2042 (system):', await b.evaluate(issueText('Transcription delayed')), '| close button:', await b.evaluate(`!!document.querySelector('[data-testid=close-without-fix]')`))
  await b.evaluate(`document.querySelector('[data-testid=simulate-recover]').click(); true`); await b.sleep(500)
  console.log('P-2042 after PulseAI recovered:', await b.evaluate(issueText('Transcription delayed')))
  await issuesTab('after every event')
  await b.goto(root + '/fieldwork/command-center?tab=issues'); await b.waitFor('Issue log'); await b.evaluate(`(() => { const s=document.querySelectorAll('#fw-panel select')[0]; s.value=''; s.dispatchEvent(new Event('change',{bubbles:true})); return true })()`); await b.sleep(500)
  await b.shot('i2-issues-record', true)
  console.log('invariants:', JSON.stringify(await b.evaluate('window.__invariants')))

  // Manual closing: only with a reason, or by giving up.
  await fresh()
  await r19('P-2061-1')
  await b.evaluate(`document.querySelector('[data-testid=close-without-fix]').click(); true`); await b.sleep(400)
  console.log('close without fix: confirm disabled with no reason =', await b.evaluate(`document.querySelector('[data-testid=confirm-close-without-fix]').disabled`))
  await b.evaluate(setText('[role=dialog] textarea', 'Participant says they will not retry.')); await b.sleep(300)
  await b.evaluate(`document.querySelector('[data-testid=confirm-close-without-fix]').click(); true`); await b.sleep(500)
  console.log('P-2061 closed:', await b.evaluate(issueText('Microphone permission denied')))
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(800)
  console.log('activity log:', await b.evaluate(`[...document.querySelectorAll('main li')].map(x=>x.innerText.replace(/\\s+/g,' ')).filter(t=>/without a fix/.test(t)).join(' || ')`))
  await needsClick('P-2065', 'Give up and replace'); await b.sleep(300)
  await b.evaluate(setText('[role=dialog] textarea', 'Unreachable.')); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].filter(x=>/Give up/.test(x.innerText)).pop().click(); true`); await b.sleep(500)
  await r19('P-2065-1'); console.log('P-2065 after give up:', await b.evaluate(issueText('Link expired or invalid')))
} finally { b.close() }
