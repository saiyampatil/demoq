// Pet Food Subscription Churn: every screen of the finished study, and the numbers on them.
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/' + (process.argv[2] ?? 'pet-food-churn')
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
const screens = [
  ['R1 brief intake', '/brief/intake'], ['R4 brief editor', '/brief/editor'], ['R5 share', '/brief/share'],
  ['R6 audience', '/audience/definition'], ['R7 screener', '/audience/screener'], ['R8 sourcing', '/audience/sourcing'], ['R9 screening', '/audience/screening'], ['R11 pool', '/audience/pool'],
  ['R12 moderator', '/guide/moderator'], ['R13 stimuli', '/guide/stimuli'], ['R14 guide', '/guide/editor'],
  ['R15 launch', '/launch/readiness'], ['R17 preflight', '/launch/preflight'],
  ['R18 fieldwork', '/fieldwork/command-center'], ['R21 queue', '/review/queue'], ['R22 session', '/review/session/P-3107-1'],
]
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Pet Food')
  console.log('R0:', await b.evaluate(`[...document.querySelectorAll('main tr')].find(r=>r.innerText.includes('Pet Food'))?.innerText.replace(/\\s+/g,' ')`))
  for (const [name, path] of screens) {
    await b.goto(root + path); await b.sleep(1700)
    const t = await b.evaluate(T)
    console.log(`\n[${name}] ${path}\n  ${(t ?? '(nothing)').slice(0, 330)}`)
  }
  await b.goto(root + '/fieldwork/command-center'); await b.sleep(1500)
  console.log('\nOverview:', (await b.evaluate(T)).slice(0, 1500))
  console.log('invariants:', JSON.stringify(await b.evaluate('window.__invariants')))
  console.log('stepper:', await b.evaluate(`document.body.innerText.split('Analysis')[0].replace(/\\s+/g,' ').slice(-330)`))
} finally { b.close() }
