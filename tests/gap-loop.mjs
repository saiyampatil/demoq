// R18 stage 1, the gap-closing loop: the actions by reserve size, the reasoning line, the top-up and the time check.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
const overview = async (label) => {
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Fieldwork command center'); await b.sleep(1100)
  console.log(`[${label}]`)
  console.log('   sentence :', (await b.evaluate(T)).match(/Only \d+ of \d+ can finish\. \d+ more \w+ (is|are) needed\./)?.[0] ?? '(no gap)')
  console.log('   plan line:', await b.evaluate(`document.querySelector('[data-testid=closing-plan]')?.innerText`))
  console.log('   buttons  :', await b.evaluate(`[...document.querySelectorAll('[aria-label="Verdict actions"] button, [aria-label="Verdict actions"] a')].map(x=>x.innerText.trim()).join(' / ')`))
  console.log('   top-up   :', await b.evaluate(`document.querySelector('[data-testid=topup-card]')?.innerText.replace(/\\s+/g,' ') ?? '-'`), '| new in reserve:', await b.evaluate(`document.querySelector('[data-testid=new-in-reserve]')?.innerText ?? '-'`))
  console.log('   time     :', await b.evaluate(`document.querySelector('[data-testid=not-enough-time]')?.innerText.replace(/\\s+/g,' ') ?? '-'`))
}
const exclude = async (sid) => {
  await b.goto(`${root}/review/session/${sid}`); await b.waitFor('Decision'); await b.sleep(1200)
  await b.evaluate(`__click('Exclude')`); await b.sleep(400)
  await b.evaluate(`document.querySelector('[role=dialog] input[type=checkbox]').click(); true`); await b.sleep(200)
  await b.evaluate(`__click('Exclude session')`); await b.sleep(500)
}
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); const proto = t.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await overview('seed: gap 2, reserve 0')
  await exclude('P-2055-1'); await overview('after Exclude P-2055: gap 3, reserve 0')
  await b.shot('g1-no-reserve')
  const shrink = async () => { await b.evaluate(`__click('Screen jump')`); await b.sleep(300); await b.evaluate(`__click('2 days left')`); await b.sleep(400); await b.evaluate(`__click('Screen jump')`); await b.sleep(300) }
  const adjust = async (button, reason) => {
    await b.goto(root + '/fieldwork/command-center'); await b.waitFor(button); await b.sleep(600)
    await b.evaluate(`__click(${JSON.stringify(button)})`); await b.sleep(400)
    console.log(`   ${button}: confirm disabled without a reason =`, await b.evaluate(`document.querySelector('[data-testid=confirm-adjust]').disabled`))
    await b.evaluate(setText('[role=dialog] textarea', reason)); await b.sleep(300)
    await b.evaluate(`document.querySelector('[data-testid=confirm-adjust]').click(); true`); await b.sleep(600)
  }
  const log = async () => console.log('   log:', await b.evaluate(`[...document.querySelectorAll('main li')].map(x=>x.innerText.replace(/\\s+/g,' ')).filter(t=>/Extended|Lowered/.test(t)).join(' || ')`))
  await shrink(); await overview('window shrunk to 2 days left (no reserve, sourcing needed)'); await b.shot('g1-time')
  await adjust('Extend window', 'Panel is slow to respond.'); await overview('after Extend window'); await log()
  await shrink(); await adjust('Lower target', 'Client agreed to a smaller sample.'); await overview('after Lower target (window short again)'); await log()
  // Source more opens R8 with the number filled in, then applicants arrive and the top-up card appears.
  await b.evaluate(`document.querySelector('[data-testid=source-more]').click(); true`); await b.sleep(900)
  console.log('R8 url:', await b.evaluate('location.pathname + location.search'), '| prefilled:', await b.evaluate(`document.querySelector('input[type=number]')?.value`))
  await b.evaluate(`__click('Simulate:')`); await b.sleep(800)
  await overview('after applicants arrive (top-up running, reserve covers the gap)'); await b.shot('g1-topup')
  await b.evaluate(`document.querySelector('[data-testid=new-in-reserve] button').click(); true`); await b.sleep(600)
  console.log('toast:', await b.evaluate(`document.querySelector('[data-testid=toast]')?.innerText.replace(/\\s+/g,' ')`))
  await overview('after Invite')
  console.log('invariants:', JSON.stringify(await b.evaluate('window.__invariants')))
} finally { b.close() }
