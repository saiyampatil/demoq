// R18 stage 3: a participant asks for a human. Offers, the fall-through, and what the Researcher can do about it.
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
const r19 = async (sid = 'P-2042-1') => { await b.goto(`${root}/fieldwork/sessions/${sid}`); await b.waitFor('Technical issues'); await b.sleep(800) }
const click = async (testid) => { await b.evaluate(`document.querySelector('[data-testid=${testid}]').click(); true`); await b.sleep(500) }
const needs = async (label) => {
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(900)
  console.log(`[Needs you: ${label}]`, await b.evaluate(`document.querySelector('#needs-you h2').innerText.replace(/\\s+/g,' ')`), '| first row:', await b.evaluate(`document.querySelector('#needs-you ul > li')?.innerText.replace(/\\s+/g,' ').slice(0,260)`))
  console.log('   clock:', await b.evaluate(`document.querySelector('[data-testid=escalation-clock]')?.innerText ?? '-'`))
}
const card = async () => console.log('   card:', await b.evaluate(`document.querySelector('[data-testid=escalation-card]')?.innerText.replace(/\\s+/g,' ') ?? '-'`))
const timeline = async () => console.log('   timeline:', await b.evaluate(`[...document.querySelectorAll('main ol li')].map(l=>l.innerText.replace(/\\s+/g,' ')).filter(t=>/human|Offered|declined|accepted|joined|timed out|waiting|assigned|booking/i.test(t)).join(' || ')`))
try {
  // A. falls through, then the Researcher assigns a moderator
  await fresh(); await needs('before')
  await r19(); await click('sim-escalate'); await card()
  await click('sim-declined'); await card(); await timeline()
  await needs('all declined: pinned first')
  await b.shot('e3-pinned')
  await click('sim-23h' ).catch(() => {})
  await r19(); await click('sim-23h'); await needs('after 23 h')
  await click('assign-moderator')
  console.log('roster:', await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].map(l=>l.innerText.replace(/\\s+/g,' ')).join(' | ')`))
  await b.shot('e3-assign')
  console.log('confirm disabled before a pick:', await b.evaluate(`document.querySelector('[data-testid=confirm-assign]').disabled`))
  await b.evaluate(`document.querySelectorAll('[role=dialog] input[type=radio]')[3].click(); true`); await b.sleep(300)
  await click('confirm-assign')
  console.log('toast:', await b.evaluate(`document.querySelector('[data-testid=toast]')?.innerText.replace(/\\s+/g,' ')`))
  await needs('after Assign (left Needs you)')
  await r19(); await card(); await timeline()
  await click('sim-assigned-joins'); await card()

  // B. accepted by standby: never in Needs you; shows under Escalated
  await fresh(); await r19(); await click('sim-escalate'); await click('sim-accepted'); await card(); await timeline()
  await needs('accepted by standby')
  await b.goto(root + '/fieldwork/command-center?tab=sessions'); await b.waitFor('Consent log'); await b.sleep(600)
  await b.evaluate(`(() => { const sel=document.querySelector('#fw-panel select'); sel.value='Escalated'; sel.dispatchEvent(new Event('change',{bubbles:true})); return true })()`); await b.sleep(400)
  console.log('Escalated filter rows:', await b.evaluate(`[...document.querySelectorAll('#fw-panel tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' ').slice(0,120)).join(' || ')`))

  // C. booking link
  await fresh(); await r19(); await click('sim-escalate'); await click('sim-declined')
  await needs('before booking link'); await click('send-booking-link')
  console.log('toast:', await b.evaluate(`document.querySelector('[data-testid=toast]')?.innerText.replace(/\\s+/g,' ')`))
  await needs('after booking link'); await r19(); await card()
  console.log('   session status:', await b.evaluate(`document.querySelector('main').innerText.match(/Booked/)?.[0]`))
  console.log('invariants:', JSON.stringify(await b.evaluate('window.__invariants')))

  // D. give up
  await fresh(); await r19(); await click('sim-escalate'); await click('sim-declined'); await needs('before give up')
  await b.evaluate(`[...document.querySelectorAll('[data-testid=escalation-row] button')].find(x=>/Give up/.test(x.innerText)).click(); true`); await b.sleep(400)
  await b.evaluate(setText('[role=dialog] textarea', 'No moderator free this week.')); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].filter(x=>/Give up/.test(x.innerText)).pop().click(); true`); await b.sleep(500)
  await needs('after give up'); await r19(); await card()

  // Pet Food: an accepted escalation in the past
  await b.goto('/researcher/studies/pet-food-churn/fieldwork/sessions/P-3115-1'); await b.waitFor('Escalation'); await b.sleep(800); await card(); await timeline(); await b.shot('e3-pet-card')
} finally { b.close() }
