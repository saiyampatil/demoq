import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn'
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Pet Food'); await b.shot('pet-r0')
  for (const [name, path] of [['pet-r18', '/fieldwork/command-center'], ['pet-r14', '/guide/editor'], ['pet-r4', '/brief/editor'], ['pet-r22', '/review/session/P-3112-1']]) {
    await b.goto(root + path); await b.sleep(2200); await b.shot(name, true)
  }
} finally { b.close() }
