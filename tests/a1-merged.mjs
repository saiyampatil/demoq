// A1 merged codes read as one code: one label, "includes …" on the code it went into, the absorbed code only under Merged.
//   npx vite --port 5199 --strictPort &   then   node tests/a1-merged.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => { checks.push(label); if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label) }
const q = JSON.stringify
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const tab = async (label) => { await b.evaluate(`[...document.querySelectorAll('[role=group] button')].find(x=>x.innerText.trim().startsWith(${q(label)}))?.click(); true`); await b.sleep(450) }
const rows = () => b.evaluate(`[...document.querySelectorAll('[data-testid=code-row]')].map(r=>({name:r.querySelector('.truncate').firstChild.textContent.trim(),text:r.innerText.replace(/\\s+/g,' ').trim(),tag:r.querySelector('[data-testid=merged-tag]')?.innerText.trim()??null,into:r.querySelector('[data-testid=merged-into]')?.innerText.trim()??null,id:r.dataset.code}))`)
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/codebook`); await b.waitFor('Codebook'); await b.sleep(1200)
  await tab('Merged')
  const merged = await rows()
  ok('the Merged tab lists the two absorbed pet codes, each pointing at the code it went into', merged.length === 2 && merged.every((r) => /→ /.test(r.into ?? '')) && merged.some((r) => /Boxes came too often/.test(r.name) && /Food piling up/.test(r.into)) && merged.some((r) => /Dog refused the new flavour/.test(r.name) && /Pet stopped eating it/.test(r.into)), merged)
  await tab('All')
  const all = await rows()
  ok('All never lists an absorbed code as a second row', !all.some((r) => /Boxes came too often|Dog refused the new flavour/.test(r.name)) && all.length > 10, all.map((r) => r.name))
  const piling = all.find((r) => r.name === 'Food piling up')
  const pet = all.find((r) => r.name === 'Pet stopped eating it')
  ok('the code each went into is one row with one label and a Merged tag saying what it includes', /includes “Boxes came too often”/.test(piling?.tag ?? '') && /includes “Dog refused the new flavour”/.test(pet?.tag ?? ''), [piling, pet])
  await b.evaluate(`document.querySelector('[data-code="c-pet-refused"]').click(); true`); await b.sleep(500)
  const panel = await b.evaluate(`({head:document.querySelector('[data-testid=merged-from] h3')?.innerText,items:[...document.querySelectorAll('[data-testid=merged-from-item]')].map(x=>x.innerText.replace(/\\s+/g,' ').trim())})`)
  ok('its panel says “One code, merged from 2” and lists the absorbed code with who merged it and why', panel.head === 'One code, merged from 2' && panel.items.length === 1 && /Dog refused the new flavour/.test(panel.items[0]) && /Merged by/.test(panel.items[0]) && /new flavour was how it showed up/.test(panel.items[0]), panel)
  // a real merge: two accepted codes become one label
  await b.evaluate(`${MOD}; (async()=>{const cb=await window.__mod('/src/state/codebook'); cb.updateCodebook('pet-food-churn', d=>cb.mergeCodes(d,'c-bag-size','c-piling-up','Too much food, too soon',{by:'Maya Ortiz'},'Same complaint.')); return true})()`); await b.sleep(800)
  await tab('All')
  const after = await rows()
  ok('after merging two codes there is one row with the one new label, and no second row for the absorbed code', after.filter((r) => /Too much food, too soon/.test(r.name)).length === 1 && !after.some((r) => r.name === 'Bag size too big' || r.name === 'Food piling up'), after.map((r) => r.name))
  const one = after.find((r) => /Too much food, too soon/.test(r.name))
  ok('that row says it includes the other code (and the earlier one: two codes)', /includes 2 codes/.test(one?.tag ?? ''), one)
  await tab('Merged')
  const m2 = await rows()
  ok('the Merged tab lists the absorbed code struck through with its target’s new label', m2.some((r) => r.name === 'Bag size too big' && /→ Too much food, too soon/.test(r.into ?? '')), m2)
} catch (e) { failures.push(`crashed: ${e.message}`) }
await b.close?.()
console.log(failures.length ? `a1-merged FAILED (${checks.length} checks):\n- ${failures.join('\n- ')}` : `a1-merged ${checks.length} checks OK`)
process.exit(failures.length ? 1 : 0)
