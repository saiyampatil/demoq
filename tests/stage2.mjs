// Stage 2, the bridges: Review decisions move Fieldwork, and the other way round. Prints each step's numbers.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
const snap = async (label) => {
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Fieldwork command center'); await b.sleep(1000)
  const t = await b.evaluate(T)
  const badge = await b.evaluate(`document.body.innerText.match(/Review\\s+\\d+ awaiting/)?.[0].replace(/\\s+/g,' ')`)
  console.log(`[${label}]`, (t.match(/\d+ confirmed, \d+ pending review, \d+ of \d+ toward target/) ?? [])[0], '|', (t.match(/Only \d+ of \d+ can finish\. \d+ more \w+ (is|are) needed\./) ?? [])[0], '|', badge, '|', (await b.evaluate(`[...document.querySelectorAll('[aria-label="Verdict actions"] button, [aria-label="Verdict actions"] a')].map(x=>x.innerText.trim()).join(' / ')`)))
  console.log('   invariants:', JSON.stringify(await b.evaluate('window.__invariants')), '| waiting line:', await b.evaluate(`document.querySelector('[data-testid=waiting-line]')?.innerText ?? '-'`))
}
const decide = async (sid, kind) => {
  await b.goto(`${root}/review/session/${sid}`); await b.waitFor('Decision'); await b.sleep(1200)
  await b.evaluate(`__click(${JSON.stringify(kind)})`); await b.sleep(400)
  if (kind === 'Exclude') { await b.evaluate(`document.querySelector('[role=dialog] input[type=checkbox]').click(); true`); await b.sleep(200); await b.evaluate(`__click('Exclude session')`) }
  if (kind === 'Accept') {
    await b.evaluate(`(() => { const t=document.querySelector('[role=dialog] textarea'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(t,'Usable.'); t.dispatchEvent(new Event('input',{bubbles:true})); const c=document.querySelector('[role=dialog] input[type=checkbox]'); if(c && !c.checked) c.click(); return true })()`); await b.sleep(300)
    await b.evaluate(`__click('Accept session')`)
  }
  await b.sleep(600)
  console.log(`   ${kind} ${sid}: toast =`, await b.evaluate(`document.querySelector('[data-testid=toast]')?.innerText.replace(/\\s+/g,' ')`))
}
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await snap('start')
  await decide('P-2057-1', 'Accept'); await snap('after Accept P-2057')
  await decide('P-2055-1', 'Exclude'); await snap('after Exclude P-2055 (no reserve)')
  // Reserve: simulate applicants arriving in R8, then the same exclusion should offer Invite from reserve.
  await b.goto(root + '/audience/sourcing'); await b.waitFor('Simulate'); await b.sleep(500)
  await b.evaluate(`__click('Simulate:')`); await b.sleep(800)
  await snap('after applicants arrive (reserve has people)')
  await b.shot('s2-overview-reserve')
  await b.evaluate(`__click('Invite from reserve')`); await b.sleep(700)
  console.log('   Invite from reserve: toast =', await b.evaluate(`document.querySelector('[data-testid=toast]')?.innerText.replace(/\\s+/g,' ')`))
  await snap('after Invite from reserve')
  // Request clarification: stays Under review, shows "Waiting for participant", and is not in Needs you.
  await b.goto(`${root}/review/session/P-2054-1`); await b.waitFor('Decision'); await b.sleep(1200)
  await b.evaluate(`__click('Request clarification')`); await b.sleep(400)
  await b.evaluate(`(() => { const t=document.querySelector('[role=dialog] textarea'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(t,'Can you confirm which concept you meant?'); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`); await b.sleep(300)
  await b.evaluate(`__click('Send request')`); await b.sleep(600)
  await snap('after Request clarification P-2054')
  await b.goto(root + '/review/queue'); await b.waitFor('Completed interviews'); await b.sleep(1200)
  console.log('   R21 row text:', await b.evaluate(`[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('P-2054'))?.innerText.replace(/\\s+/g,' ')`))
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(800)
  console.log('   P-2054 in Needs you?', await b.evaluate(`document.querySelector('#needs-you').innerText.includes('P-2054')`))
  // Reopen the excluded P-2055: counts reverse.
  await b.goto(`${root}/review/session/P-2055-1`); await b.waitFor('Decision record'); await b.sleep(800)
  await b.evaluate(`__click('Reopen for review')`); await b.sleep(400)
  await b.evaluate(`(() => { const t=document.querySelector('[role=dialog] textarea'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(t,'Second look.'); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`); await b.sleep(300)
  await b.evaluate(`__click('Reopen for review', '[role=dialog] button')`); await b.sleep(600)
  await snap('after Reopen P-2055')
  // Close fieldwork is blocked, with the reason.
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Close fieldwork'); await b.sleep(600)
  console.log('close fieldwork disabled:', await b.evaluate(`document.querySelector('[data-testid=close-fieldwork]')?.disabled`))
  console.log('analysis lock reason in page:', await b.evaluate(`(document.documentElement.innerHTML.match(/\\d+ of \\d+ sessions? still needs? a Review decision/) ?? [])[0]`))
  // Clear the blockers: the running session completes, the rest are given up.
  await b.goto(`${root}/fieldwork/sessions/P-2042-1`); await b.waitFor('Simulate: session completes'); await b.sleep(400)
  await b.evaluate(`__click('Simulate: session completes')`); await b.sleep(500)
  for (let i = 0; i < 8; i++) {
    await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(700)
    const has = await b.evaluate(`!!__q('#needs-you button','Give up and replace')`)
    if (!has) break
    await b.evaluate(`__click('Give up and replace', '#needs-you button')`); await b.sleep(400)
    await b.evaluate(`(() => { const t=document.querySelector('[role=dialog] textarea'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(t,'Unreachable.'); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`); await b.sleep(300)
    await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].filter(x=>/Give up/.test(x.innerText)).pop().click(); true`); await b.sleep(500)
  }
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Close fieldwork'); await b.sleep(700)
  console.log('after clearing blockers, close enabled:', await b.evaluate(`!document.querySelector('[data-testid=close-fieldwork]')?.disabled`))
  await b.evaluate(`document.querySelector('[data-testid=close-fieldwork]').click(); true`); await b.sleep(400)
  await b.evaluate(`document.querySelector('[data-testid=confirm-close]').click(); true`); await b.sleep(800)
  console.log('closed banner:', await b.evaluate(`!!document.body.innerText.includes('Fieldwork is closed')`), '| header:', (await b.evaluate(T)).match(/(Live|Complete|Paused) Release/)?.[0])
  await b.shot('s2-closed')
  // Analysis stays locked until every session is decided; then it opens.
  console.log('analysis (undecided):', await b.evaluate(`(document.documentElement.innerHTML.match(/\\d+ of \\d+ sessions? still needs? a Review decision/) ?? [])[0]`))
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`__click('Dev demo: decide every session')`); await b.sleep(600)
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.goto(root + '/review/queue'); await b.waitFor('Completed interviews'); await b.sleep(800)
  console.log('analysis unlocked (no lock reason left):', await b.evaluate(`!/still needs? a Review decision/.test(document.documentElement.innerHTML)`), '| invariants:', JSON.stringify(await b.evaluate('window.__invariants')))
  await b.shot('s2-analysis-open')
} finally { b.close() }
