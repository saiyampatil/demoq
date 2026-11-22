// Ice Cream Flavour Concept Test: the codebook (A1).
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/ice-cream-flavours'
const T = `document.querySelector('main')?.innerText.replace(/\\s+/g,' ')`
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto(root + '/analysis/codebook'); await b.sleep(2500)
  console.log('A1:', (await b.evaluate(T)).slice(0, 1800))
  await b.shot('ice-a1', true)
} finally { b.close() }
