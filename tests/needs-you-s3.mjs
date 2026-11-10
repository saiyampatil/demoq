// Needs you, grace periods: what shows at the seed time and after each step of simulated time.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept'
const out = {}
const list = `[...document.querySelectorAll('#needs-you ul > li')].map(l=>{const t=l.innerText.replace(/\\s+/g,' ').trim();return t.slice(0,95)})`
const count = `document.querySelector('#needs-you h2').innerText.replace(/\\s+/g,' ')`
// The simulated clock lives in the Screen jump panel (nothing dev-only shows on the page), so open it, act, close it.
const step = async (label) => {
  await b.evaluate(`document.querySelector('[role=dialog]') || __click('Screen jump'); true`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=needs-dev] button')].find(x=>x.innerText.trim()===${JSON.stringify(label)}).click(); true`); await b.sleep(500)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`); await b.sleep(250)
}
const showAll = async () => { await b.evaluate(`[...document.querySelectorAll('#needs-you button')].find(x=>/^Show all/.test(x.innerText.trim()))?.click(); true`); await b.sleep(250) }
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.goto(root + '/fieldwork/command-center'); await b.waitFor('Needs you'); await b.sleep(900)
  out['seed'] = [await b.evaluate(count), await b.evaluate(list)]
  await step('+15 min'); out['+15 min'] = [await b.evaluate(count)]
  await step('+30 min'); out['+45 min total'] = [await b.evaluate(count)]
  await step('+2 h'); await showAll(); out['+2h45 total'] = [await b.evaluate(count), await b.evaluate(list)]
  await b.evaluate(`document.getElementById('needs-you').scrollIntoView({block:'start'}); true`); await b.sleep(300); await b.shot('needs-you-s3')
  await step('+24 h'); await showAll(); out['+26h45 total'] = [await b.evaluate(count), await b.evaluate(list)]
  out.inv = await b.evaluate(`window.__invariants`)
  console.log(JSON.stringify(out, null, 1))
  // Rows appear only when their grace period has run out, and nothing leaves by time alone.
  const n = (k) => Number((out[k][0].match(/Needs you (\d+)/) ?? [])[1])
  const who = (k) => (out[k][1] ?? []).map((r) => r.slice(0, 6))
  const bad = []
  const must = (c, m) => { if (!c) bad.push(m) }
  must(n('seed') === 7 && n('+15 min') === 7 && n('+45 min total') === 7, `no new rows in the first 45 minutes (got ${n('seed')}, ${n('+15 min')}, ${n('+45 min total')})`)
  must(n('+2h45 total') === 9 && who('+2h45 total').includes('P-2042') && who('+2h45 total').includes('P-2052'), 'P-2042 (PulseAI still working) and P-2052 (consented, never started) are due after about 2 h 45 min')
  must(!who('seed').includes('P-2042') && !who('seed').includes('P-2052'), 'P-2042 and P-2052 are not due at the seed time')
  must(n('+26h45 total') === 10 && who('+26h45 total').includes('P-2051'), 'P-2051 (consented, never started) is due after about 26 h 45 min')
  must(who('+2h45 total').every((p) => who('+26h45 total').includes(p)), 'nothing leaves Needs you by time alone')
  must(/Our side/.test(out['+2h45 total'][1][0]) && out['+2h45 total'][1][0].startsWith('P-2042'), 'the PulseAI row is our side and comes first')
  must(!out.inv?.length, 'invariant violations')
  console.log(bad.length ? 'NEEDS-YOU S3 FAILED: ' + bad.join('; ') : 'NEEDS-YOU S3 OK')
  if (bad.length) process.exitCode = 1
} finally { b.close() }
