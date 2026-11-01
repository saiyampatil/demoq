// Prints one screen's text: node tests/peek.mjs <study> <path> [chars]
import { launch } from './cdp.mjs'
const b = await launch()
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Pet Food')
  await b.goto(`/researcher/studies/${process.argv[2]}${process.argv[3]}`); await b.sleep(1800)
  console.log(await b.evaluate(`document.querySelector('main')?.innerText.replace(/\\s+/g,' ').slice(0, ${Number(process.argv[4] ?? 1800)})`))
} finally { b.close() }
