// The middle case: the reserve covers only part of the gap.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.goto(root + '/audience/sourcing?topup=2'); await b.waitFor('Simulate'); await b.sleep(500)
  await b.evaluate(`__click('Simulate:')`); await b.sleep(700)
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Fieldwork command center'); await b.sleep(1000)
  console.log('plan line:', await b.evaluate(`document.querySelector('[data-testid=closing-plan]')?.innerText`))
  console.log('buttons  :', await b.evaluate(`[...document.querySelectorAll('[aria-label="Verdict actions"] button, [aria-label="Verdict actions"] a')].map(x=>x.innerText.trim()).join(' / ')`))
  console.log('sentence :', (await b.evaluate(`document.querySelector('main').innerText.replace(/\\s+/g,' ')`)).match(/Only \d+ of \d+ can finish\. \d+ more \w+ (is|are) needed\./)?.[0])
} finally { b.close() }
