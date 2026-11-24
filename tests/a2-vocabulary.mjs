// A2 final vocabulary and colour system: one shared map, no old display string on any rendered screen, chip colours, icons and tooltips,
// "Mixed" only as a verdict, tiles in order, contrast, and the numbers unchanged.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-vocabulary.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const q = JSON.stringify
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const PRE = `${MOD};
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const sess=await window.__mod('/src/mock/sessions'); const sg=await window.__mod('/src/state/signals'); const cfg=await window.__mod('/src/config/delivery')
  const store=()=>Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]
  const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'))
  const basisOf=(parts)=>cb.basisOf(parts.map(p=>({id:sid(p),participantId:p})))
  const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS)`
const run = (body) => b.evaluate(`(async()=>{${PRE}; ${body}})()`)
const click = async (sel, i = 0) => { const done = await b.poll(`(()=>{const e=document.querySelectorAll(${q(sel)})[${i}];if(!e||e.disabled)return false;e.click();return true})()`); if (!done) throw new Error(`nothing to click for ${sel}`); await b.sleep(300) }

// colours
const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)); const r = /rgba?\(([^)]+)\)/.exec(h)?.[1].split(',').map(Number); return r ? r.slice(0, 3) : null }
const lum = ([r, g, bl]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl) }
const contrast = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const blend = (rgba, under) => { const m = /rgba\(([^)]+)\)/.exec(rgba); if (!m) return rgb(rgba); const [r, g, bl, a] = m[1].split(',').map(Number); return [r, g, bl].map((v, i) => Math.round(v * a + under[i] * (1 - a))) }
const hue = ([r, g, bl]) => { const [R, G, B] = [r, g, bl].map((v) => v / 255); const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn; if (!d) return 0; const h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; return (Math.round(h * 60) + 360) % 360 }
const sat = ([r, g, bl]) => { const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl); return mx ? (mx - mn) / mx : 0 }

const BANNED = /argued for|complain(ed|s|t|ts)?\b|\bPositive words|\bNegative words|Their words:|\bFactual\b|Complains about it|took a position|spoke for|speaks for|speak for|pulled against|pulls against|uncertain|unsure|\bfits\b|partly fits|doesn.t fit|facts only|no claim|conflicting/i
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals`); await b.waitFor('What stood out'); await b.sleep(900)

  // ── one shared map (source) ──
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]))
  const srcFiles = walk('src').filter((f) => /\.(ts|tsx)$/.test(f))
  const defs = srcFiles.filter((f) => /VERDICT_LABEL\s*=|FIT_LABEL\s*[:=]/.test(readFileSync(f, 'utf8')))
  ok('the verdict and match labels are defined once, in src/config/delivery.ts', defs.length === 1 && defs[0] === 'src/config/delivery.ts', defs)
  const lit = srcFiles.filter((f) => f !== 'src/config/delivery.ts' && /['"`](No position|Gap)['"`]|['"`]No match['"`]|['"`]Hesitant['"`]/.test(readFileSync(f, 'utf8')))
  ok('no other file hardcodes “No position”, “Gap”, “No match” or “Hesitant”', lit.length === 0, lit)
  const hexes = srcFiles.filter((f) => f !== 'src/config/delivery.ts' && /#1f5a37|#6b4a00|#8f1220|rgba\(46, 125, 79|rgba\(196, 22, 42/.test(readFileSync(f, 'utf8')))
  ok('the chip colours live only in the shared map', hexes.length === 0, hexes)
  const cfg = await run('return {v:cfg.VERDICT_LABEL,f:cfg.FIT_LABEL,fo:cfg.FIT_ORDER,w:cfg.SIDE_LABEL,vc:cfg.VERDICT_COLOUR,fc:cfg.FIT_COLOUR,vd:cfg.VERDICT_DEF,fd:cfg.FIT_DEF}')
  ok('verdicts: Consistent, Mixed, Gap, No position, Too few to read; match: Matched, No match, Hesitant in that order; what people said: Spoke in favour, Spoke against it, Just described it', JSON.stringify(cfg.v) === JSON.stringify({ Consistent: 'Consistent', Mixed: 'Mixed', Conflicting: 'Gap', 'No claim': 'No position', 'Too few to read': 'Too few to read' }) && JSON.stringify(cfg.fo.map((k) => cfg.f[k])) === JSON.stringify(['Matched', 'No match', 'Hesitant']) && JSON.stringify(cfg.w) === JSON.stringify({ Positive: 'Spoke in favour', Negative: 'Spoke against it', Neutral: 'Just described it' }), cfg)
  ok('the definitions say what the brief says', /More than half of the people with a position matched/.test(cfg.vd.Consistent) && /Neither side has more than half, including when many were hesitant/.test(cfg.vd.Mixed) && /More than half had no match/.test(cfg.vd.Conflicting) && /Nobody took a side/.test(cfg.vd['No claim']) && /Under 3 people/.test(cfg.vd['Too few to read']) && /never counts toward Gap/i.test(cfg.fd.Uncertain), cfg.vd)

  // ── contrast of chip text (on the tint over white, and over the grey table header) ──
  const cs = []
  for (const [k, c] of [...Object.entries(cfg.vc), ...Object.entries(cfg.fc)]) for (const under of [[255, 255, 255], [241, 241, 246], [241, 238, 253]]) cs.push([k, under.join(), Math.round(contrast(rgb(c.fg), blend(c.bg === 'transparent' ? 'rgba(255,255,255,0)' : c.bg, under)) * 10) / 10])
  ok('text on every chip passes 4.5:1 (on white, on the table header and on a selected row)', cs.every(([, , r]) => r >= 4.5), cs.filter(([, , r]) => r < 4.5))
  const alpha = Object.values(cfg.vc).concat(Object.values(cfg.fc)).filter((c) => c.bg !== 'transparent').map((c) => Number(/,\s*([\d.]+)\)$/.exec(c.bg)[1]))
  ok('the tint is subtle but readable: between 8 and 14 percent', alpha.every((a) => a >= 0.08 && a <= 0.14), alpha)
  const hues = { green: hue(rgb(cfg.vc.Consistent.accent)), amber: hue(rgb(cfg.vc.Mixed.accent)), red: hue(rgb(cfg.vc.Conflicting.accent)), grey: sat(rgb(cfg.vc['No claim'].accent)), indigo: hue(rgb(cfg.fc.Uncertain.accent)) }
  ok('the colours are what the brief says: green, amber, red, grey, indigo', hues.green > 100 && hues.green < 160 && hues.amber > 35 && hues.amber < 55 && (hues.red < 15 || hues.red > 345) && hues.grey < 0.2 && hues.indigo > 235 && hues.indigo < 270, hues)

  // ── every rendered screen: no old display string ──
  const content = `(()=>{const out=new Set(); const add=(t)=>t&&out.add(String(t)); doc.codes.forEach(c=>{add(c.name);add(c.definition);c.excerpts.forEach(id=>{try{add(ms.excerptPoint(id).excerpt?.text)}catch{}})}); doc.themes.forEach(t=>{add(t.name);add(t.definition)}); ms.TENSION_DEFS.forEach(t=>{add(t.title);add(t.summary)}); return [...out]})()`
  const scan = async (label) => {
    const text = await b.evaluate(`(async()=>{${PRE}; let t=document.body.innerText; for (const c of ${content}.sort((a,b)=>b.length-a.length)) t=t.split(c).join(' '); return t})()`)
    const hit = text.match(BANNED)
    ok(`no old display string on ${label}`, !hit, hit && text.slice(Math.max(0, hit.index - 40), hit.index + 40))
  }
  await click('[data-testid=expand-all]')
  await scan('A2 Themes')
  const nThemes = await b.evaluate(`document.querySelectorAll('[data-testid=theme-row]').length`)
  for (let i = 0; i < nThemes; i++) { await click('[data-testid=theme-name]', i); await scan(`the theme panel ${i + 1}`) }
  // Clicking the name of Not in a theme folds it, so open everything again.
  await b.evaluate(`(()=>{const e=document.querySelector('[data-testid=expand-all]');if(/^Expand all/.test(e.innerText))e.click();return true})()`); await b.sleep(300)
  const nCodes = await b.evaluate(`document.querySelectorAll('[data-testid=signal-row]').length`)
  for (let i = 0; i < nCodes; i++) { await click('[data-testid=signal-row]', i); await scan(`the code panel ${i + 1}`) }
  await click('[data-testid=how-to-read]'); await scan('How to read this')
  const pop = await b.evaluate(`({lines:document.querySelectorAll('[data-testid=key-rules] li').length,verdicts:[...document.querySelectorAll('[data-testid=key-verdicts] li')].map(e=>e.innerText.replace(/\\s+/g,' ').trim()),fits:[...document.querySelectorAll('[data-testid=key-fits] li')].map(e=>e.innerText.replace(/\\s+/g,' ').trim())})`)
  ok('the popover lists all five verdict definitions, the three match labels (and split across codes) and the five rule lines, each once', pop.lines === 5 && pop.verdicts.length === 5 && pop.verdicts.every((v, i) => v.startsWith(Object.values(cfg.v)[i])) && pop.fits.length === 4 && pop.fits.slice(0, 3).map((f) => f.split(' ')[0]).join() === ['Matched', 'No', 'Hesitant'].join(), pop)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(200)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(700); await scan('A2 Tensions')
  await b.goto(`${root}/report`); await b.waitFor('Outputs'); await b.sleep(1500); await scan('A3 Report')
  await b.goto(`${root}/report/themes-map`); await b.waitFor('Theme map'); await b.sleep(1200); await scan('the Theme map')
  await click('[data-testid=mode] button', 1); await b.sleep(400); await scan('the Theme map (Words vs delivery colours)')
  await b.evaluate(`document.querySelector('[data-testid=bubble]').click(); true`); await b.sleep(500); await scan('the Theme map panel')
  const tmChips = await b.evaluate(`[...document.querySelectorAll('[data-testid=verdict-chip] [data-verdict-chip],[data-testid=panel-verdict] [data-verdict-chip]')].length`)
  ok('the Theme map uses the same verdict chips', tmChips >= 1, tmChips)
  await b.goto(`${root}/report/audio`); await b.sleep(1800); await scan('the Audio summary')

  // ── the Signals screen: chips, icons, tooltips, colours ──
  await b.goto(`${root}/signals`); await b.waitFor('What stood out'); await b.sleep(900)
  await click('[data-testid=expand-all]')
  await click('[data-testid=signal-row]', 0)
  await click('[data-testid=how-to-read]')
  const chips = await b.evaluate(`[...document.querySelectorAll('[data-verdict-chip],[data-fit-chip]')].map(e=>{const s=getComputedStyle(e);return {kind:e.dataset.verdictChip??e.dataset.fitChip,text:e.innerText.trim(),icon:e.querySelector('svg[data-icon]')?.dataset.icon??null,title:e.title,bg:s.backgroundColor,fg:s.color,bw:s.borderTopWidth,bs:s.borderTopStyle,bc:s.borderTopColor}})`)
  const kinds = [...new Set(chips.map((c) => c.kind))]
  ok('all five verdicts are on the screen (so each was checked)', ['Consistent', 'Mixed', 'Conflicting', 'No claim', 'Too few to read'].every((k) => kinds.includes(k)), kinds)
  ok('every chip has an icon, a text label and a tooltip with its definition', chips.length > 20 && chips.every((c) => c.icon && c.text.length > 1 && c.title.length > 10), chips.filter((c) => !c.icon || !c.title).slice(0, 3))
  ok('each verdict has its own icon: check, tilde, alert, dash, dotted circle', ['Consistent', 'Mixed', 'Conflicting', 'No claim', 'Too few to read'].every((k) => chips.filter((c) => c.kind === k).every((c) => c.icon === k)) && new Set(chips.filter((c) => cfg.vc[c.kind]).map((c) => c.icon)).size === 5)
  const byKind = (k) => chips.find((c) => c.kind === k)
  const want = { Consistent: cfg.vc.Consistent, Mixed: cfg.vc.Mixed, Conflicting: cfg.vc.Conflicting, 'No claim': cfg.vc['No claim'] }
  ok('computed chip colours match the shared map (tinted background, muted border, dark text)', Object.entries(want).every(([k, c]) => { const x = byKind(k); const a = /rgba\(([^)]+)\)/.exec(x.bg)?.[1].split(',').map((v) => +v); const ca = /rgba\(([^)]+)\)/.exec(c.bg)[1].split(',').map((v) => +v); return a && a.slice(0, 3).join() === ca.slice(0, 3).join() && Math.abs(a[3] - ca[3]) < 0.02 && x.fg === `rgb(${rgb(c.fg).join(', ')})` && x.bw === '1px' && x.bs === 'solid' }), chips.filter((c) => want[c.kind]).slice(0, 4))
  ok('Too few to read is transparent with a dotted outline', byKind('Too few to read').bs === 'dotted' && /rgba\(0, 0, 0, 0\)|transparent/.test(byKind('Too few to read').bg), byKind('Too few to read'))
  ok('the person-level chips are Matched, No match and Hesitant, with the shared colours', chips.filter((c) => !cfg.vc[c.kind]).length >= 2 && chips.filter((c) => !cfg.vc[c.kind]).every((c) => c.text === cfg.f[c.kind] && c.fg === `rgb(${rgb(cfg.fc[c.kind].fg).join(', ')})`), chips.filter((c) => !cfg.vc[c.kind]).slice(0, 3))
  const chroma = chips.filter((c) => cfg.vc[c.kind] && c.kind !== 'Too few to read' && c.kind !== 'No claim')
  // (The Face and Speech colour legends and the face, tone and certainty readings are gone from the page, so the checks that kept their colours apart and drew them as dots are gone with them.)

  // ── no pill for a face or speech reading; Mixed only as a verdict ──
  const mixed = await b.evaluate(`(()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(/\\bMixed\\b/.test(n.textContent)){const e=n.parentElement;if(!e.closest('[data-verdict-chip],[data-testid=how-decided-pop],[data-testid=read-pop],[data-testid=tick-hint],[data-testid=check-none],[data-testid=legend]'))out.push(n.textContent.trim().slice(0,60))}}return out})()`)
  ok('“Mixed” appears only as a verdict (a chip, its definition, or a sentence about the verdict)', mixed.length === 0, mixed)

  // ── panels: heading, question, tiles in order, for every code ──
  const panels = []
  for (let i = 0; i < nCodes; i++) {
    await click('[data-testid=signal-row]', i)
    panels.push(await b.evaluate(`(()=>{const p=document.querySelector('[data-testid=signal-panel]');const g=[...p.querySelectorAll('[data-testid=tile-group]')];return {name:p.querySelector('h2').innerText.trim(),words:p.querySelector('[data-testid=summary-sentence]')?.innerText.replace(/\\s+/g,' ').trim(),q:p.querySelector('[data-testid=match-question]')?.innerText.trim(),tiles:g.length?[...g[0].querySelectorAll('[data-testid=match-tiles] > button')].map(d=>d.querySelector('dt').innerText.trim()):[],n:[0,1,2].map(k=>g.reduce((a,x)=>a+Number([...x.querySelectorAll('[data-testid=match-tiles] > button')][k].dataset.n),0))}})()`))
  }
  const shaped = panels.filter((p) => p.tiles.length)
  ok('every code panel opens with the one-sentence summary, then the question, then the tiles Matched · No match · Hesitant', shaped.length >= 8 && shaped.every((p) => /^\d+ of \d+ people were verbally|^\d+ (person|people) spoke|^Nobody took a side|^Only \d+ (person|people) said this, too few to read a pattern/.test(p.words) && p.q === 'Did their delivery match their words?' && p.tiles.join() === 'Matched,No match,Hesitant'), [shaped.length, nCodes, panels.length, ...shaped.slice(0, 2)])
  ok('no code panel opens with a sentence like “4 of 4 complained.”', panels.every((p) => !/complained|argued for/.test(p.words ?? '')))
  const rows = await run(`return sg.codeSignals(doc,basis).map(s=>({name:s.code.name,fits:s.fit.fits,against:s.fit.against,unc:s.fit.uncertain,n:s.fit.n,verdict:s.fit.pattern}))`)
  ok('every code panel’s tiles equal that code’s own counts', shaped.every((p) => { const r = rows.find((x) => x.name === p.name); return r && p.n.join() === [r.fits, r.against, r.unc].join() }), shaped.filter((p) => { const r = rows.find((x) => x.name === p.name); return !(r && p.n.join() === [r.fits, r.against, r.unc].join()) }).slice(0, 2))
  await b.goto(`${root}/signals`); await b.waitFor('What stood out'); await b.sleep(700)
  const rowChips = await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].map(r=>({name:r.querySelector('.font-medium,.font-semibold').innerText.trim(),kind:r.querySelector('[data-verdict-chip]').dataset.verdictChip}))`)
  ok('every code row’s chip is its own verdict, unchanged', rowChips.every((r) => { const x = rows.find((y) => y.name === r.name); return x && (x.verdict === r.kind || (r.kind === 'Too few to read' && x.n < 3)) }), rowChips.filter((r) => !rows.find((y) => y.name === r.name && y.verdict === r.kind)).slice(0, 3))
  ok('every code panel’s chip rows come from the same split, and the verdict follows the rule (more than half matched: Consistent, more than half no match: Gap)', rows.every((r) => r.n < 3 || r.n === r.fits + r.against + r.unc && (r.against / r.n > 0.5 ? r.verdict === 'Conflicting' : r.fits / r.n > 0.5 ? r.verdict === 'Consistent' : r.verdict === 'Mixed')), rows.filter((r) => r.n >= 3).slice(0, 2))
} catch (e) {
  failures.push(`crashed: ${e.message}`)
}
await b.close?.()
console.log(failures.length ? `a2-vocabulary FAILED (${checks.length} checks):\n- ${failures.join('\n- ')}` : `a2-vocabulary ${checks.length} checks OK`)
process.exit(failures.length ? 1 : 0)
