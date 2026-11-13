// A3 Theme map: accepted themes only, size is people, colour is reaction strength, the ring is A2's verdict; segments, the panel,
// tension lines, a steady layout, the motion rules and the guided tour.
//   npx vite --port 5199 --strictPort &   then   node tests/a3-thememap.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const URL = '/researcher/studies/pet-food-churn/analysis/report/themes-map'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const q = (s) => JSON.stringify(s)
const count = (sel) => b.evaluate(`document.querySelectorAll(${q(sel)}).length`)
const text = (sel) => b.evaluate(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const click = async (sel) => { const done = await b.poll(`(()=>{const e=document.querySelector(${q(sel)});if(!e||e.disabled)return false;e.click();return true})()`); if (!done) throw new Error(`nothing to click for ${sel}`); await b.sleep(250) }
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const PRE = `${MOD};
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const sess=await window.__mod('/src/mock/sessions'); const tm=await window.__mod('/src/state/themeMap'); const cfg=await window.__mod('/src/config/themeMap'); const lay=await window.__mod('/src/lib/themeLayout'); const sg=await window.__mod('/src/state/signals'); const em=await window.__mod('/src/mock/emotion')
  const store=()=>Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]
  const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'))
  const basisOf=(parts)=>cb.basisOf(parts.map(p=>({id:sid(p),participantId:p})))`
const run = (body) => b.evaluate(`(async()=>{${PRE}; ${body}})()`)
const open = async (qs = '') => { await b.goto(`${URL}${qs}`); await b.waitFor('Theme map'); await b.sleep(1500) }
const bubbles = () => b.evaluate(`[...document.querySelectorAll('[data-testid=bubble]')].map(x=>({key:x.dataset.key,n:Number(x.dataset.n),of:Number(x.dataset.of),band:x.dataset.band,verdict:x.dataset.verdict,label:x.getAttribute('aria-label')}))`)
const pos = () => b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-fill]')].map(c=>c.dataset.key+':'+c.getAttribute('cx')+','+c.getAttribute('cy')).join('|')`)
const codebook = () => b.evaluate(`localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))`)
const seg = async (s) => { await click(`[data-testid=segment-${s}]`); await b.sleep(700) }
const pickB = async (key) => { await b.evaluate(`document.querySelector('[data-testid=bubble][data-key="${key}"]').click(); true`); await b.sleep(400) }

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto('/researcher/studies/pet-food-churn/analysis/report'); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(1200)
  await click('[data-testid=tool-theme-map]'); await b.waitFor('Back to Report'); await b.sleep(800)
  ok('Theme map in Tools opens /report/themes-map', /\/analysis\/report\/themes-map$/.test(await b.evaluate('location.pathname')))
  ok('the header has the description, the study line and the Lens selector', /Size is how many people said it\. Colour is how strong the reaction was\./.test(await b.evaluate('document.body.innerText')) && /Built on 20 accepted sessions · 2 excluded left out · Release v1\.0/.test((await text('[data-testid=built-on]')) ?? '') && (await count('[data-testid=lens-select]')) === 1)
  await click('[data-testid=back-to-report]'); await b.waitFor('EXECUTIVE SUMMARY')
  await open()
  const cbBefore = await codebook()

  // ═══ What feeds the map ═══
  const all = await bubbles()
  const data = await run(`const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const excl=sess.PET_SEED_SESSIONS.filter(s=>s.review?.status==='Excluded').map(s=>s.participant); const bs=tm.bubblesOf(doc,basis,'all')
    return {themes:cb.codeThemes(doc).map(t=>t.name).sort(),names:bs.map(x=>x.name),leak:bs.flatMap(x=>[...x.people]).filter(p=>excl.includes(p)).length,excl,sizes:[tm.segmentSize(basis,'all'),tm.segmentSize(basis,'Cat'),tm.segmentSize(basis,'Dog')],people:bs.map(x=>[x.key,x.people.size,x.n])}`)
  ok('one bubble per accepted theme, plus one grey “Not in a theme”', data.names.slice().sort().join() === [...data.themes, 'Not in a theme'].sort().join() && all.length === data.themes.length + 1, data.names)
  ok('excluded sessions are never counted, and N is the 20 accepted (12 dog, 8 cat)', data.excl.length === 2 && data.leak === 0 && JSON.stringify(data.sizes) === JSON.stringify([20, 8, 12]), data)
  ok('size is people: a bubble’s n is the people with a statement there, a person counted once', data.people.every(([, p, n]) => p === n), data.people)
  const radii = await b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-fill]')].map(c=>({n:Number(document.querySelector('[data-testid=bubble][data-key="'+c.dataset.key+'"]').dataset.n),r:Number(c.dataset.r)}))`)
  const maxN = Math.max(...radii.map((r) => r.n))
  ok('radius is on a square-root scale of people', radii.every((r) => Math.abs(r.r - Math.round(28 + 64 * (Math.sqrt(r.n) / Math.sqrt(maxN)))) <= 1), radii)
  ok('no percentages anywhere', !/%/.test(await b.evaluate('document.body.innerText')))
  ok('every bubble is a button with an accessible name: name, n of N, strength in words, words-vs-delivery in words', all.length === 3 && all.every((x) => /^.+, \d+ of \d+ people, (high|medium|low) reaction strength|not enough read, (words and delivery (matched|pulled apart|partly matched)|too few to read)$/.test(x.label)), all.map((x) => x.label))

  // ═══ Strength, bands and the verdict ═══
  const rules = await run(`const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const bs=tm.bubblesOf(doc,basis,'all'); const sigs=sg.themeSignals(doc,basis)
    const band=[0.6,0.59,0.3,0.29,0.95,0].map(v=>cfg.strengthBandOf(v))
    const same=bs.every(b=>b.verdict===sigs.find(s=>s.id===b.key).verdict && b.ring===({Consistent:'solid',Conflicting:'dashed',Mixed:'dotted'}[b.verdict]??'none'))
    const note=[tm.directionalNote(4),tm.directionalNote(5),tm.directionalNote(0)]
    // An audio-only person is read on voice and hesitation: counted, and strong when the voice is animated; never dropped as neutral.
    const audio=ms.ACCEPTED_PARTICIPANTS.find(p=>!em.hasVideo(p)); const pts=sg.codeSignals(doc,basis).flatMap(s=>s.points).filter(p=>p.participantId===audio)
    const fake={...pts[0],voice:{...pts[0].voice,tone:'Animated'},band:'Steady'}; const flat={...pts[0],voice:{...pts[0].voice,tone:'Even'},band:'Steady'}
    return {band,same,note,thr:cfg.THEME_MAP.strength,audio,strongAnimated:tm.isStrong(fake,doc),strongEven:tm.isStrong(flat,doc),faceFlag:cfg.THEME_MAP.faceInColour,minRead:cfg.THEME_MAP.minRead,bubbles:bs.map(b=>({k:b.key,read:b.read,people:b.people.size,band:b.band,notEnough:b.notEnough,share:b.share}))}`)
  ok('strength bands use the config thresholds: 0.60 High, 0.59 and 0.30 Medium, 0.29 Low', JSON.stringify(rules.band) === JSON.stringify(['High', 'Medium', 'Medium', 'Low', 'High', 'Low']) && rules.thr.high === 0.6 && rules.thr.medium === 0.3, rules)
  ok('the ring and the verdict are A2’s, reused: Consistent solid, Conflicting dashed, Mixed dotted', rules.same, rules)
  ok('the face reading is behind its flag, off by default, so colour is voice and hesitation only', rules.faceFlag === false)
  ok('an audio-only person counts on voice and hesitation: animated is strong, even is not, and they are never dropped as neutral', rules.strongAnimated === true && rules.strongEven === false && rules.audio, rules)
  ok('the segment note is “Directional. Fewer than 5 people.” under 5 and nothing at 5 or more', rules.note[0] === 'Directional. Fewer than 5 people.' && rules.note[1] == null && rules.note[2] == null, rules.note)

  // ═══ Segments ═══
  const fills0 = await b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-fill]')].map(c=>c.dataset.key+':'+c.dataset.r+':'+c.dataset.fill).join('|')`)
  const p0 = await pos()
  await seg('Cat')
  const cat = await bubbles()
  ok('Cat owners: n and N change (“n of 8 cat owners”)', cat.every((x) => x.of === 8) && cat.every((x) => /of 8 cat owners/.test(x.label)) && cat.some((x, i) => x.n !== all[i].n), cat.map((x) => x.label))
  ok('a theme with fewer than 3 people read shows “not enough read”, hatched grey', cat.some((x) => x.band === 'not-enough') && (await b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-fill]')].some(c=>c.dataset.hatched==='true' && c.getAttribute('fill')==='url(#tm-hatch)')`)))
  ok('moving to a segment does not move any bubble', (await pos()) === p0)
  const sizesCat = await b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-fill]')].map(c=>Number(c.dataset.r))`)
  await seg('Dog')
  const dog = await bubbles()
  const sizesDog = await b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-fill]')].map(c=>Number(c.dataset.r))`)
  ok('cat and dog owners give visibly different sizes for at least two themes', sizesCat.filter((r, i) => Math.abs(r - sizesDog[i]) >= 10).length >= 2 && dog.every((x) => x.of === 12), { sizesCat, sizesDog })
  ok('the segment line is the AI-generated summary, built from the bubbles (the largest theme changes with the segment)', /is the largest theme\./.test((await text('[data-testid=summary]')) ?? ''))
  await seg('all')
  ok('back to Everyone restores the same sizes and colours', (await b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-fill]')].map(c=>c.dataset.key+':'+c.dataset.r+':'+c.dataset.fill).join('|')`)) === fills0)

  // ═══ Colour mode, the ring ═══
  await click('[data-testid=mode-verdict]'); await b.sleep(400)
  const vfills = await b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-fill]')].map(c=>({k:c.dataset.key,fill:c.dataset.fill,verdict:document.querySelector('[data-testid=bubble][data-key="'+c.dataset.key+'"]').dataset.verdict}))`)
  ok('Words vs delivery colours: Consistent neutral, Conflicting amber, Mixed light amber; “Not in a theme” stays grey', vfills.filter((f) => f.k !== 'none').every((f) => f.fill === { Consistent: '#eceef2', Conflicting: '#f0b955', Mixed: '#f8e3b5' }[f.verdict]) && vfills.find((f) => f.k === 'none').fill === '#d3d6dc', vfills)
  ok('the ring is the same in both colour modes and states the verdict', (await b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-ring]')].map(r=>r.dataset.ring).join()`)) === 'solid,solid,dashed')
  await click('[data-testid=mode-strength]')

  // ═══ The panel ═══
  const p1 = await pos()
  await pickB('t-price')
  ok('opening the panel moves no bubble', (await pos()) === p1)
  ok('the panel has the name, n of N people, strength in words, the verdict chip and a headline', /Price creep/.test((await text('[data-testid=panel-name]')) ?? '') && /8 of 20 people · low reaction strength/.test((await text('[data-testid=panel-numbers]')) ?? '') && /Consistent/.test((await text('[data-testid=panel-verdict]')) ?? '') && /Delivery matched the words/.test((await text('[data-testid=panel-headline]')) ?? ''))
  const quotes = await b.evaluate(`[...document.querySelectorAll('[data-testid=quote]')].map(x=>x.innerText)`)
  ok('quotes show participant and session IDs, time, Play, segment, the code and the delivery reading in plain words', quotes.length >= 10 && quotes.every((t) => /P-\d+ · P-\d+/.test(t) && /\d:\d\d/.test(t) && /Play/.test(t) && /(Dog|Cat) owner · /.test(t) && /Voice (animated|even|flat|tense) · (No|Some|Marked) hesitation/.test(t)), quotes[0])
  const conf = await b.evaluate(`[...document.querySelectorAll('[data-testid=quote]')].length`)
  await click('[data-testid=code-chip]')
  ok('a code chip filters the quotes, and again clears it', (await count('[data-testid=quote]')) < conf && (await (async () => { await click('[data-testid=code-chip]'); return count('[data-testid=quote]') })()) === conf)
  ok('the panel is read only: no Ignore, Delete or Add', (await count('[data-testid=ignore], [data-testid=delete], [data-testid=add-statement]')) === 0)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(400)
  ok('Esc closes the panel and returns focus to the bubble', (await count('[data-testid=panel]')) === 0 && (await b.evaluate(`document.activeElement?.dataset?.key`)) === 't-price')

  // ═══ Layout ═══
  const l2 = await run(`const sets={a:new Set(['1','2','3','4']),b:new Set(['1','2','3','5']),c:new Set(['7','8','9','10'])}; const ov=(x,y)=>lay.overlapOf(sets[x],sets[y]); const items=[{key:'a',r:50},{key:'b',r:50},{key:'c',r:50}]
    const one=lay.layoutBubbles(items,ov,900,520,'seed'); const two=lay.layoutBubbles(items,ov,900,520,'seed'); const d=(x,y)=>{const p=one.find(i=>i.key===x),q=one.find(i=>i.key===y);return Math.hypot(p.x-q.x,p.y-q.y)}
    const overlaps=one.some((p,i)=>one.some((q,j)=>j>i&&Math.hypot(p.x-q.x,p.y-q.y)<p.r+q.r)); const inside=one.every(p=>p.x-p.r>=0&&p.x+p.r<=900&&p.y-p.r>=0&&p.y+p.r<=520)
    return {same:JSON.stringify(one)===JSON.stringify(two),closer:d('a','b')<d('a','c'),ovAB:ov('a','b'),ovAC:ov('a','c'),overlaps,inside}`)
  ok('the same data gives the same layout twice, with no overlap and nothing outside the picture', l2.same && !l2.overlaps && l2.inside, l2)
  ok('two themes sharing more people sit closer than two sharing fewer', l2.closer && l2.ovAB > l2.ovAC, l2)
  await open()
  ok('a reload gives the same positions', (await pos()) === p1)

  // ═══ Tension lines ═══
  ok('with no tension added there is no line (5 are only suggested, 1 is dismissed)', (await count('[data-testid=tension-line]')) === 0)
  await run(`cb.updateCodebook('pet-food-churn', d=>cb.dismissTension(d,{id:'tn-pet-segments',title:'t'},{by:'Maya Ortiz'},'no')); return true`); await b.sleep(500)
  ok('a dismissed tension draws no line', (await count('[data-testid=tension-line]')) === 0)
  await run(`cb.updateCodebook('pet-food-churn', d=>cb.restoreTension(d,{id:'tn-pet-segments',title:'t'},{by:'Maya Ortiz'})); return true`); await b.sleep(500)
  ok('a restored tension is only suggested again, so still no line', (await count('[data-testid=tension-line]')) === 0)
  await run(`cb.updateCodebook('pet-food-churn', d=>cb.turnTensionIntoTheme(d,{id:'tn-pet-segments',title:'Cat owners lean to flexibility; dog owners lean to price'},['c-flex-first','c-price-first'],'Cats and flexibility, dogs and price','x',{by:'Maya Ortiz'})); cb.updateCodebook('pet-food-churn', d=>cb.turnTensionIntoTheme(d,{id:'tn-pause-concept',title:'one'},['c-idea-pause'],'Pause: slow','x',{by:'Maya Ortiz'})); return true`); await b.sleep(700)
  ok('an approved tension connecting two bubbles draws a dashed line; one with nothing to connect is skipped', (await count('[data-testid=tension-line]')) === 1 && (await b.evaluate(`document.querySelector('[data-testid=tension-line] line').getAttribute('stroke-dasharray')`)) === '6 5' && /Cat owners lean to flexibility/.test(await b.evaluate(`document.querySelector('[data-testid=tension-line] title').textContent`)))
  ok('and the tension themes themselves are not bubbles', (await count('[data-testid=bubble]')) === 3)

  const cbAfterSetup = await codebook()

  // ═══ Motion ═══
  const css = await b.evaluate(`(()=>{const f=document.querySelector('.tm-fill');const g=document.querySelector('.tm-settle');const bb=document.querySelector('.tm-bubble');const cols=document.querySelector('.tm-cols');return {fill:getComputedStyle(f).transitionDuration,settle:getComputedStyle(g).animationDuration,hover:getComputedStyle(bb).transitionDuration,cols:getComputedStyle(cols).transitionDuration,stagger:[...document.querySelectorAll('.tm-settle')].map(x=>getComputedStyle(x).animationDelay)}})()`)
  ok('motion is as listed: bubbles settle in 0.6 s, resize in 0.4 s, hover in 0.12 s, the map rescales in 0.2 s, staggered largest first', /0\.4s/.test(css.fill) && css.settle === '0.6s' && css.hover === '0.12s' && css.cols === '0.2s' && css.stagger.some((d) => d === '0s'), css)
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await b.sleep(300)
  const reduced = await b.evaluate(`(()=>{const sel=['.tm-fill','.tm-ring','.tm-text','.tm-halo','.tm-bubble','.tm-cols','.tm-settle'];return sel.map(s=>{const e=document.querySelector(s);const c=getComputedStyle(e);return s+':'+c.transitionDuration+':'+c.animationName})})()`)
  ok('with reduced motion set, every transition and animation on the page is instant', reduced.every((r) => /^[^:]+:(0|1e-05)s:none$/.test(r)), reduced)
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await b.evaluate(`document.querySelector('[data-testid=bubble][data-key="t-pet"]').dispatchEvent(new MouseEvent('mouseover',{bubbles:true})); true`); await b.sleep(300)
  const dimmed = await b.evaluate(`[...document.querySelectorAll('[data-testid=bubble-g]')].map(g=>g.style.opacity)`)
  ok('hover or focus dims the others to about 40%', dimmed.filter((o) => o === '0.4').length === 2 && dimmed.filter((o) => o === '1').length === 1, dimmed)
  ok('and the tension line stays visible', (await count('[data-testid=tension-line]')) === 1)

  // ═══ The tour ═══
  await b.evaluate(`document.querySelector('[data-testid=bubble][data-key="t-pet"]').dispatchEvent(new MouseEvent('mouseout',{bubbles:true})); true`); await b.sleep(200)
  await click('[data-testid=tour-start]')
  const order = await run(`const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const bs=tm.tourOrder(tm.bubblesOf(doc,basis,'all')); return {names:bs.map(x=>x.name),captions:bs.map(x=>tm.tourCaption(x,'all')),end:tm.TOUR_END}`)
  const seen = []
  for (let i = 0; i <= order.names.length; i++) {
    seen.push(await text('[data-testid=tour-caption]'))
    if (i < order.names.length) await click('[data-testid=tour-next]')
  }
  ok('the tour visits themes largest first and each caption is built from the data', JSON.stringify(seen.slice(0, order.names.length)) === JSON.stringify(order.captions.map((c) => c.replace(/\s+/g, ' '))) && order.names.length === 3, { seen, order })
  ok('captions use only data values: name, n of N people, and words-vs-delivery counts', seen.slice(0, 3).every((c) => /^.+\. \d+ of 20 people\. (Delivery matched the words\.|Words and delivery (partly )?pulled apart in \d+ of \d+ read\.|Too few read to say\.)$/.test(c)), seen)
  ok('it ends on the final step', seen[seen.length - 1] === 'That is every approved theme.' && (await b.evaluate(`document.querySelector('[data-testid=tour-next]').disabled`)))
  ok('the tour opens no panel and changes nothing in the codebook', (await count('[data-testid=panel]')) === 0 && (await codebook()) === cbAfterSetup)
  await click('[data-testid=tour-prev]')
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})); true`); await b.sleep(200)
  ok('the arrow keys step the tour', Number(await b.evaluate(`document.querySelector('[data-testid=tour-caption]').dataset.step`)) === 1)
  const stepNow = Number(await b.evaluate(`document.querySelector('[data-testid=tour-caption]').dataset.step`))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(300)
  ok('Esc stops the tour', (await count('[data-testid=tour-bar]')) === 0 && stepNow === 1)
  await click('[data-testid=tour-start]')
  ok('Auto is off by default', !(await b.evaluate(`document.querySelector('[data-testid=tour-auto]').checked`)))
  await click('[data-testid=tour-stop]')

  // ═══ List view, states ═══
  await click('[data-testid=view-list]')
  const rows = await b.evaluate(`[...document.querySelectorAll('[data-testid=list-row]')].map(r=>({key:r.dataset.key,n:Number(r.dataset.n),of:Number(r.dataset.of),band:r.dataset.band,verdict:r.dataset.verdict}))`)
  const mapBubbles = await run(`const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); return tm.bubblesOf(doc,basis,'all').map(b=>({key:b.key,n:b.n,of:b.of,band:b.notEnough?'not-enough':b.band,verdict:b.verdict}))`)
  ok('List view has the same themes, numbers, bands and verdicts as the map, ranked', JSON.stringify(rows.map((r) => [r.key, r.n, r.of, r.band, r.verdict]).sort()) === JSON.stringify(mapBubbles.map((r) => [r.key, r.n, r.of, r.band, r.verdict]).sort()) && rows.every((r, i) => i === 0 || rows[i - 1].n >= r.n), rows)
  ok('the map never wrote to the codebook: every click, segment, colour mode, panel and tour left it as it was', (await codebook()) === cbAfterSetup)
  await open('?demo=error')
  ok('?demo=error shows “The theme map didn’t load” with Retry', /The theme map didn’t load/.test(await b.evaluate('document.body.innerText')))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A3 THEME MAP FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A3 THEME MAP OK')
