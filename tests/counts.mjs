// Prints the live value of every session count on every screen, so disagreements are visible, then the dev invariant check.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
const grab = (re) => `(() => { const m = ${T}.match(${re}); return m ? m[0] : null })()`
const read = async (path, wait, ...exprs) => { await b.goto(root + path); await b.waitFor(wait); await b.sleep(900); return Promise.all(exprs.map((e) => b.evaluate(e))) }
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  const rows = {}
  const [ov] = await read('/fieldwork/command-center', 'Fieldwork command center', T)
  rows['R18 header'] = (ov.match(/\d+ confirmed, \d+ pending review, \d+ of \d+ toward target/) ?? [])[0]
  rows['Verdict'] = (ov.match(/(Only \d+ of \d+ can finish\. \d+ more \w+ (is|are) needed\.|On track|Behind pace)/) ?? [])[0]
  rows['Verdict basis'] = (ov.match(/\d+ counting \([^)]*\)[^=]*= \d+\./) ?? [])[0]
  rows['Slot ledger legend'] = await b.evaluate(`document.querySelector('[data-testid=slot-legend]')?.innerText.replace(/\\s+/g,' ')`)
  rows['Slot ledger boxes'] = await b.evaluate(`document.querySelectorAll('[data-testid=slots] li').length`)
  rows['Slots opened'] = await b.evaluate(`document.querySelector('[data-testid=slots-summary]')?.innerText.replace(/\\s+/g,' ')`)
  rows['Funnel'] = (ov.match(/Invited \d+.*?Completed \d+/) ?? [])[0]?.replace(/ (1|2|3|4|5|6|7|8|9) (haven|opened|no-show|consented|withdrew|in progress|left|technical|given)[^A-Z]*/g, ' ')
  rows['Funnel sum line'] = (ov.match(/\d+ invited = [^.]*\./) ?? [])[0]
  rows['Target card'] = (ov.match(/\d+ of \d+ \d+ confirmed, \d+ pending review\./) ?? [])[0]
  rows['Needs you'] = await b.evaluate(`document.querySelector('#needs-you h2')?.innerText.replace(/\\s+/g,' ')`)
  rows['Awaiting-review link'] = (ov.match(/\d+ sessions? awaiting review/) ?? [])[0]
  const [tabs] = await read('/fieldwork/command-center?tab=sessions', 'Consent log', `[...document.querySelectorAll('[role=tab]')].map(x=>x.innerText.replace(/\\s+/g,' ')).join(' | ')`)
  rows['R18 tab badges'] = tabs
  const [cards, stepper] = await read('/review/queue', 'Completed interviews', `document.querySelector('section[aria-label=Summary]')?.innerText.replace(/\\s+/g,' ')`, `[...document.querySelectorAll('a,button')].map(x=>x.innerText.replace(/\\s+/g,' ')).find(t=>/^Review \\d+ awaiting/.test(t)) ?? document.body.innerText.match(/Review\\s+\\d+ awaiting/)?.[0]`)
  rows['R21 cards'] = cards
  rows['Stepper Review badge'] = stepper
  await b.goto('/researcher'); await b.waitFor('Moisturizer'); await b.sleep(600)
  rows['R0 (seed)'] = await b.evaluate(`[...document.querySelectorAll('main tr')].find(r=>r.innerText.includes('Moisturizer Concept Study'))?.innerText.replace(/\\s+/g,' ')`)
  rows['R0 (Oat Milk)'] = await b.evaluate(`[...document.querySelectorAll('main tr')].find(r=>r.innerText.includes('Oat Milk'))?.innerText.replace(/\\s+/g,' ')`)
  await b.goto('/researcher/studies/oat-barista/review/queue'); await b.sleep(1500)
  rows['Oat Milk R21'] = await b.evaluate(`document.querySelector('main')?.innerText.replace(/\\s+/g,' ').slice(0,260)`)
  rows['Oat Milk stepper'] = await b.evaluate(`document.body.innerText.match(/Review\\s+[^\\n]*/)?.[0]`)
  for (const [k, v] of Object.entries(rows)) console.log(k.padEnd(22), '|', typeof v === 'string' ? v : JSON.stringify(v))
  await b.goto(root + '/fieldwork/command-center'); await b.sleep(1500)
  const inv = await b.evaluate(`window.__invariants`)
  console.log('INVARIANT VIOLATIONS:', JSON.stringify(inv))
} finally { b.close() }
