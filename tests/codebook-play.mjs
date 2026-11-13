// A1: Play in the Codebook side panel opens the mock player right there and doesn't leave the screen.
import { launch } from './cdp.mjs'
const b = await launch()
const fails = []
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); true')
  await b.goto('/researcher/studies/pet-food-churn/analysis/codebook'); await b.sleep(1500)
  // open the first code row
  await b.evaluate(`(()=>{const r=document.querySelector('[data-testid=code-row], tr[data-code], [data-testid=codes] button, table tbody tr');r&&r.click();return true})()`)
  await b.poll(`document.querySelectorAll('[data-testid=quote-play]').length>0`, 6000)
  const before = await b.evaluate('location.pathname')
  await b.evaluate(`document.querySelector('[data-testid=quote-play]').click(); true`); await b.sleep(400)
  const after = await b.evaluate('location.pathname')
  const player = await b.evaluate(`document.querySelectorAll('[data-testid=clip-player]').length`)
  const link = await b.evaluate(`!!document.querySelector('[data-testid=quote-open-session]')`)
  if (before !== after) fails.push('Play left the screen: ' + after)
  if (player !== 1) fails.push('no player: ' + player)
  if (!link) fails.push('no Open session link')
  await b.evaluate(`document.querySelector('[data-testid=quote-play]').click(); true`); await b.sleep(300)
  if ((await b.evaluate(`document.querySelectorAll('[data-testid=clip-player]').length`)) !== 0) fails.push('Hide clip did not close it')
} catch (e) { fails.push('stopped: ' + e.message) } finally { b.close() }
console.log(fails.length ? 'CODEBOOK PLAY FAILED:\n - ' + fails.join('\n - ') : 'CODEBOOK PLAY OK')
process.exitCode = fails.length ? 1 : 0
