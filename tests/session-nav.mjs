// Session page: back link keeps the list, Previous/Next follow it, dev controls live in Screen jump.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept/fieldwork'
const out = {}
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`)
  await b.viewport(1440, 700)
  await b.goto(`${root}/command-center?tab=sessions&filter=Completed`); await b.sleep(800)
  await b.evaluate(`window.scrollTo(0, 300); true`); await b.sleep(200)
  await b.evaluate(`[...document.querySelectorAll('tbody tr')][8].click(); true`); await b.sleep(900)
  out.url1 = await b.evaluate(`location.pathname + location.search`)
  out.pos = await b.evaluate(`document.querySelector('[data-testid=session-position]').innerText`)
  await b.evaluate(`[...document.querySelectorAll('nav[aria-label="Sessions in this list"] a')].pop().click(); true`); await b.sleep(600)
  out.posNext = await b.evaluate(`document.querySelector('[data-testid=session-position]').innerText + ' ' + document.querySelector('h1').innerText`)
  await b.evaluate(`[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Back to Sessions').click(); true`); await b.sleep(1000)
  out.back = await b.evaluate(`({url: location.pathname + location.search, scrollY, marked: [...document.querySelectorAll('tbody tr')].filter(r=>r.className.split(' ').includes('bg-iris-50')).map(r=>r.innerText.slice(0,10)), rows: document.querySelectorAll('tbody tr').length, filter: document.querySelector('select').value})`)
  // dev controls in Screen jump on an active session
  await b.goto(`${root}/sessions/P-2042`); await b.sleep(900)
  out.pageHasDev = await b.evaluate(`/Simulate/.test(document.body.innerText)`)
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  out.panel = await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].map(x=>x.innerText).filter(t=>/Simulate/.test(t))`)
  await b.evaluate(`document.querySelector('[data-testid=simulate-complete]').click(); true`); await b.sleep(500)
  out.simulated = await b.evaluate(`document.querySelector('[data-testid=simulated]')?.innerText`)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`)
  out.statusAfter = await b.evaluate(`document.querySelector('[data-testid=session-story]').innerText`)
  // actions: P-2048 has Retry/Give up; pause study and check disabled
  await b.goto(`${root}/sessions/P-2048`); await b.sleep(800)
  out.actions = await b.evaluate(`[...document.querySelectorAll('[data-testid=session-actions] button')].map(x=>x.innerText+(x.disabled?' (disabled)':''))`)
  await b.goto(`${root}/command-center`); await b.sleep(600)
  await b.evaluate(`__click('Pause fieldwork')`); await b.sleep(300)
  await b.evaluate(`(()=>{const ta=document.querySelector('[role=dialog] textarea'); if(ta){const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(ta,'Check'); ta.dispatchEvent(new Event('input',{bubbles:true}))} return true})()`); await b.sleep(200)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].filter(x=>/Pause/.test(x.innerText)).pop().click(); true`); await b.sleep(600)
  await b.goto(`${root}/sessions/P-2048`); await b.sleep(800)
  out.pausedActions = await b.evaluate(`[...document.querySelectorAll('[data-testid=session-actions] button')].map(x=>x.innerText+(x.disabled?' (disabled)':''))`)
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
  const bad = []
  const must = (c, m) => { if (!c) bad.push(m) }
  must(/\?from=sessions&filter=Completed$/.test(out.url1) && out.pos === '9 of 14', `a row opens its session with the list it came from (${out.url1}, ${out.pos})`)
  must(out.posNext.startsWith('10 of 14'), `Next follows the list (${out.posNext})`)
  must(out.back.filter === 'Completed' && out.back.rows === 14 && /viewed=P-2059-1/.test(out.back.url), 'Back to Sessions keeps the filter and marks the session you were on')
  must(out.back.scrollY === 300 && out.back.marked.length === 1, `Back to Sessions keeps the scroll position and marks one row (${out.back.scrollY}, ${out.back.marked.length})`)
  must(out.pageHasDev === false, 'no dev control shows on the session page itself')
  must(out.panel.includes('Simulate: session completes'), 'the dev controls are in Screen jump')
  must(/Under review/.test(out.simulated ?? '') && /In Review it is Under review/.test(out.statusAfter ?? ''), 'a simulated completion lands in Review')
  must(out.actions.join('|') === 'Retry|Give up and replace', `P-2048 offers Retry and Give up (${out.actions})`)
  must(out.pausedActions.every((x) => x.endsWith('(disabled)')), 'both are disabled while the study is paused')
  must(!out.inv?.length, 'invariant violations')
  console.log(bad.length ? 'SESSION-NAV FAILED: ' + bad.join('; ') : 'SESSION-NAV OK')
  if (bad.length) process.exitCode = 1
} finally { b.close() }
