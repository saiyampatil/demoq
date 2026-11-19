// A2 Signals: a theme row opens a theme-level insight in the right panel. Two controls (the name, the chevron), the switch only toggles,
// the insight is computed from the theme-level numbers, Codes to check, the "← theme" link, and the shared verdict labels.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-theme-panel.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const q = (s) => JSON.stringify(s)
const text = (sel) => b.evaluate(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ').trim() ?? null`)
const count = (sel) => b.evaluate(`document.querySelectorAll(${q(sel)}).length`)
const clickIn = async (scope, sel, i = 0) => {
  const done = await b.poll(`(()=>{const e=[...document.querySelectorAll(${q(scope)})][${i}]?.querySelector(${q(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click in ${scope} for ${sel}`)
  await b.sleep(350)
}
const click = async (sel) => { const done = await b.poll(`(()=>{const e=document.querySelector(${q(sel)});if(!e||e.disabled)return false;e.click();return true})()`); if (!done) throw new Error(`nothing to click for ${sel}`); await b.sleep(350) }
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const PRE = `${MOD};
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const sess=await window.__mod('/src/mock/sessions'); const sg=await window.__mod('/src/state/signals'); const em=await window.__mod('/src/state/emotion'); const cfg=await window.__mod('/src/config/delivery')
  const store=()=>Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]
  const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'))
  const basisOf=(parts)=>cb.basisOf(parts.map(p=>({id:sid(p),participantId:p})))
  const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const themes=sg.themeSignals(doc,basis)`
const run = (body) => b.evaluate(`(async()=>{${PRE}; ${body}})()`)
const LABELS = ['Consistent', 'Mixed', 'Gap', 'No position', 'Too few to read']
const LABEL_OF = { Consistent: 'Consistent', Mixed: 'Mixed', Conflicting: 'Gap', 'No claim': 'No position', 'Too few to read': 'Too few to read' }

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(900)

  // ── the data the page should show, worked out here from the theme profiles ──
  const T = await run(`return themes.filter(t=>t.kind!=='tension').map(t=>{
    const claim=t.points.filter(p=>p.stance==='Positive'||p.stance==='Negative')
    const side=(k)=>{const m=t.points.filter(p=>p.stance===k);return {n:m.length,hes:m.filter(p=>p.band==='Marked hesitation').length}}
    return {id:t.id,name:t.name,people:t.people,of:t.of,verdict:t.verdict,fit:t.fit,stances:t.stances,sides:{Positive:side('Positive'),Negative:side('Negative')},
      audioOnly:t.points.filter(p=>!em.hasVideo(p.participantId)).length,
      faces:t.emotions.read,codes:t.codes.map(c=>({id:c.code.id,name:c.code.name,pattern:c.fit.pattern,against:c.fit.against,people:c.people})),
      insight:(({summary,patterns,check,coverage})=>({sentence:summary.sentence,patterns,check:check.map(c=>c.code.id),coverage}))(sg.themeInsight(t,doc))}})`)
  ok('there are themes to read, with a “Not in a theme” group', T.length >= 3 && T.some((t) => t.id === 'none'), T.map((t) => t.name))

  // ── on load ──
  const groups = () => b.evaluate(`[...document.querySelectorAll('[data-testid=theme-group]')].map(g=>({id:g.dataset.groupId,rows:g.querySelectorAll('[data-testid=signal-row]').length,open:g.querySelector('[data-testid=theme-chevron]').getAttribute('aria-expanded')}))`)
  const g0 = await groups()
  ok('codes are expanded on load: every theme shows all its codes and its chevron says expanded', g0.length === T.length && g0.every((g) => g.open === 'true' && g.rows === T.find((t) => t.id === g.id).codes.length), g0)
  ok('no theme panel is open on load (the code panel is, as before)', (await count('[data-testid=theme-panel]')) === 0 && (await count('[data-testid=signal-panel]')) === 1)

  // ── the row: verdict chip and Said by, from the theme-level numbers ──
  const rows = await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].map(r=>({name:r.querySelector('[data-testid=theme-name]').innerText.trim(),count:r.querySelector('[data-testid=group-count]').innerText.trim(),chip:r.querySelector('[data-testid=theme-verdict]').innerText.trim(),said:r.querySelector('[data-testid=theme-said-by]').innerText.trim()}))`)
  ok('each theme row reads: name, “n codes”, its verdict chip, “Said by n of 20”, all from the theme profile', rows.every((r, i) => r.name === T[i].name && r.count === `${T[i].codes.length} code${T[i].codes.length === 1 ? '' : 's'}` && r.chip === LABEL_OF[T[i].verdict] && r.said === `Said by ${T[i].people} of ${T[i].of}`), rows)
  ok('the “of” is 20 on every row', rows.every((r) => /of 20$/.test(r.said)), rows.map((r) => r.said))

  // ── clicking the name: opens the panel, never the chevron or the switch ──
  const sw = () => b.evaluate(`[...document.querySelectorAll('[data-testid=use-group]')].map(s=>s.getAttribute('aria-checked')+'|'+(s.dataset.mixed??''))`)
  const swBefore = await sw()
  const price = T.find((t) => t.name === 'Price creep')
  const iPrice = T.indexOf(price)
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-name]', iPrice)
  ok('clicking the theme name opens the theme panel', (await count('[data-testid=theme-panel]')) === 1 && (await count('[data-testid=signal-panel]')) === 0 && (await text('[data-testid=theme-panel-name]')) === 'Price creep')
  ok('the name click leaves the chevron expanded and every switch as it was', JSON.stringify((await groups()).map((g) => g.open)) === JSON.stringify(g0.map(() => 'true')) && JSON.stringify(await sw()) === JSON.stringify(swBefore))
  ok('the selected theme row has the selected style, and no code row is selected', (await b.evaluate(`(()=>{const r=document.querySelectorAll('[data-testid=theme-row]')[${iPrice}];return r.dataset.selected==='true'&&/inset_2px_0_0/.test(r.className)&&/bg-iris-50/.test(r.className)&&document.querySelectorAll('[data-testid=signal-row][aria-current=true]').length===0})()`)))
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-verdict]', 1)
  ok('clicking the verdict chip opens that theme’s panel too', (await text('[data-testid=theme-panel-name]')) === T[1].name)

  // ── the panel, top to bottom, theme by theme ──
  // (The sentence, the question line, the tile groups and the wording are checked in a2-summary.mjs.)
  for (let i = 0; i < T.length; i++) {
    const t = T[i]
    await clickIn('[data-testid=theme-row]', '[data-testid=theme-name]', i)
    const p = await b.evaluate(`(()=>{const el=document.querySelector('[data-testid=theme-panel]');return {name:el.querySelector('[data-testid=theme-panel-name]').innerText.trim(),said:el.querySelector('[data-testid=theme-panel-said-by]').innerText.trim(),chip:el.querySelector('header [data-testid=verdict-pill]').innerText.trim(),tag:/AI-generated/.test(el.querySelector('[data-testid=theme-figures]').innerText),sentence:el.querySelector('[data-testid=summary-sentence]')?.innerText.trim(),chips:[...el.querySelectorAll('[data-testid=check-chip]')].map(c=>c.dataset.codeId),none:el.querySelector('[data-testid=check-none]')?.innerText.trim(),cov:el.querySelector('[data-testid=theme-coverage]').innerText.trim()}})()`)
    const claim = t.stances.Positive + t.stances.Negative
    ok(`${t.name}: name, “Said by n of N” and verdict chip match the row`, p.name === t.name && p.said === `Said by ${t.people} of ${t.of}` && p.chip === LABEL_OF[t.verdict], p)
    ok(`${t.name}: an AI-generated tag sits above the summary sentence`, p.tag && !!p.sentence)
    ok(`${t.name}: the people with a side (${claim}) are the same base as the row’s fit (${t.fit.n})`, claim === t.fit.n)
    const rankOf = (c) => (c.pattern === 'Conflicting' ? 0 : 1)
    const want = T[i].codes.filter((c) => c.pattern === 'Mixed' || c.pattern === 'Conflicting').sort((a, c) => rankOf(a) - rankOf(c) || c.against - a.against || a.name.localeCompare(c.name)).map((c) => c.id)
    ok(`${t.name}: Codes to check lists only Mixed and Gap codes, Gap first`, JSON.stringify(p.chips) === JSON.stringify(want) && JSON.stringify(t.insight.check) === JSON.stringify(want), [p.chips, want])
    ok(`${t.name}: with none to check it says “None. No code is Mixed or Gap.”`, want.length ? p.none === undefined : p.none === 'None. No code is Mixed or Gap.', p.none)
    const described = t.people - claim
    const wantCov = [described > 0 ? `${described} just described it` : '', t.audioOnly > 0 ? `${t.audioOnly} audio-only, read on speech` : '', `faces read for ${t.faces} of ${t.people}`].filter(Boolean).join(' · ')
    ok(`${t.name}: the coverage line says “${wantCov}”`, p.cov === wantCov, p.cov)
    ok(`${t.name}: no bar, chart or proportion graphic in the theme panel`, await b.evaluate(`(()=>{const el=document.querySelector('[data-testid=theme-panel]');return el.querySelectorAll('svg:not([aria-hidden=true]),canvas,img,[role=img],[role=progressbar],meter,progress,[style*="width"]').length===0})()`))
  }

  // ── a code chip: opens the code panel, brings its row into view, and the back link returns ──
  const withChip = T.find((t) => t.insight.check.length)
  const iChip = T.indexOf(withChip)
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-name]', iChip)
  await click('[data-testid=check-chip]')
  const codeId = withChip.insight.check[0]
  const afterChip = await b.evaluate(`({panel:document.querySelector('[data-testid=signal-panel]')?.getAttribute('aria-label'),theme:document.querySelectorAll('[data-testid=theme-panel]').length,current:document.querySelector('[data-testid=signal-row][aria-current=true]')?.dataset.code,back:document.querySelector('[data-testid=back-to-theme]')?.innerText.replace(/\\s+/g,' ').trim(),inView:(()=>{const r=document.querySelector('[data-code="${codeId}"]')?.getBoundingClientRect();return !!r&&r.top>=0&&r.bottom<=innerHeight})()})`)
  const codeName = withChip.codes.find((c) => c.id === codeId).name
  ok('clicking a chip opens that code’s own panel, selects its row and brings it into view', afterChip.panel === `Signals for ${codeName}` && afterChip.theme === 0 && afterChip.current === codeId && afterChip.inView, afterChip)
  ok(`the code panel has a “← ${withChip.name}” link at the top`, afterChip.back === `← ${withChip.name}`, afterChip.back)
  await click('[data-testid=back-to-theme]')
  ok('the “← theme” link returns to the theme panel', (await text('[data-testid=theme-panel-name]')) === withChip.name && (await count('[data-testid=signal-panel]')) === 0)
  // a code row inside the selected theme also gets the link; a code row in another theme does not
  await clickIn(`[data-group-id=${q(withChip.id).replace(/"/g, '')}]`, '[data-testid=signal-row]', 0)
  ok('a code row inside the selected theme opens its panel with the “← theme” link', (await count('[data-testid=back-to-theme]')) === 1 && (await count('[data-testid=signal-panel]')) === 1)
  const other = T.find((t) => t.id !== withChip.id)
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-name]', iChip)
  await clickIn(`[data-group-id=${other.id}]`, '[data-testid=signal-row]', 0)
  ok('a code row in a different theme opens its panel without the link', (await count('[data-testid=back-to-theme]')) === 0 && (await count('[data-testid=signal-panel]')) === 1)
  ok('a plain code row click works as before: it selects the row and opens the code panel', (await count('[data-testid=signal-row][aria-current=true]')) === 1)

  // ── the chevron: folds and unfolds, never opens the panel ──
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-name]', 0)
  const panelBefore = await text('[data-testid=theme-panel-name]')
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-chevron]', 1)
  let g1 = await groups()
  ok('the chevron folds that theme’s codes away', g1[1].open === 'false' && g1[1].rows === 0 && g1.filter((_, k) => k !== 1).every((g) => g.open === 'true'), g1)
  ok('the chevron never opens a panel or changes the one open', (await text('[data-testid=theme-panel-name]')) === panelBefore && (await count('[data-testid=signal-panel]')) === 0)
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-chevron]', 1)
  g1 = await groups()
  ok('the chevron opens them again', g1.every((g) => g.open === 'true') && g1[1].rows === T[1].codes.length)
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-name]', 1)
  ok('the name opens the panel without folding the codes', (await text('[data-testid=theme-panel-name]')) === T[1].name && (await groups())[1].open === 'true')

  // ── the switch: only toggles the report state ──
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-name]', 0)
  const sBefore = await sw()
  await b.evaluate(`document.querySelectorAll('[data-testid=use-group]')[1].click(); true`); await b.sleep(400)
  const sAfter = await sw()
  ok('the switch toggled that theme’s report state', JSON.stringify(sBefore) !== JSON.stringify(sAfter), [sBefore, sAfter])
  ok('the switch never selects its theme, never opens or folds anything, and leaves the open panel alone', (await text('[data-testid=theme-panel-name]')) === T[0].name && (await groups()).every((g) => g.open === 'true') && (await b.evaluate(`document.querySelectorAll('[data-testid=theme-row][data-selected=true]').length`)) === 1)
  await b.evaluate(`document.querySelectorAll('[data-testid=use-group]')[1].click(); true`); await b.sleep(300)

  // ── related tensions ──
  const rel = await run(`const tn=sg.tensionsOf(doc,basis); return themes.map(t=>{const ids=new Set(t.codes.map(c=>c.code.id)); const m=tn.filter(x=>!x.unavailable&&x.codeIds.some(i=>ids.has(i))); return {id:t.id,added:m.filter(x=>x.status==='Added as a tension theme').map(x=>x.title),review:m.filter(x=>x.status==='Suggested').length}})`)
  let sawAdded = false, sawReview = false
  for (let i = 0; i < T.length; i++) {
    await clickIn('[data-testid=theme-row]', '[data-testid=theme-name]', i)
    const line = await text('[data-testid=theme-tension]')
    const r = rel[i]
    const want = [r.added.length ? `Related ${r.added.length === 1 ? 'tension' : 'tensions'}: ${r.added.join(' · ')}` : '', r.review ? `${r.review} tension${r.review === 1 ? '' : 's'} to review` : ''].filter(Boolean).join(' ')
    ok(`${T[i].name}: the tension line is ${want ? `“${want}”` : 'absent'}`, want ? line === want : line === null, [line, want])
    sawAdded ||= r.added.length > 0; sawReview ||= r.review > 0
  }
  ok('the seed has a theme with an accepted tension and a theme with a tension to review, so both lines were checked', sawAdded && sawReview, rel)
  const iRev = rel.findIndex((r) => r.review > 0)
  await clickIn('[data-testid=theme-row]', '[data-testid=theme-name]', iRev)
  await click('[data-testid=theme-tension-review]')
  ok('“n tension to review” goes to the Tensions tab', /tab=tensions/.test(await b.evaluate('location.search')) || (await count('[data-testid=tension-card]')) > 0)

  // ── labels: one map ──
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(800)
  const map = await run(`return cfg.VERDICT_LABEL`)
  ok('the shared map says Consistent, Mixed, Gap, No position, Too few to read', JSON.stringify(map) === JSON.stringify({ Consistent: 'Consistent', Mixed: 'Mixed', Conflicting: 'Gap', 'No claim': 'No position', 'Too few to read': 'Too few to read' }), map)
  const chips = await b.evaluate(`[...document.querySelectorAll('[data-testid=fit-cell],[data-testid=theme-verdict]')].map(e=>e.innerText.trim())`)
  ok('every verdict chip on the table (codes and themes) uses only the shared labels', chips.length >= 10 && chips.every((c) => LABELS.includes(c)), [...new Set(chips)])
  const cells = await b.evaluate(`[...document.querySelectorAll('[data-testid=face-cell],[data-testid=speech-label]')].map(e=>e.innerText.trim())`)
  ok('no Face or Speech cell says “Mixed”; “No clear lead” is used instead', cells.length > 10 && !cells.some((c) => /Mixed/.test(c)) && cells.some((c) => c === 'No clear lead'), [...new Set(cells)])
  const head = await b.evaluate(`document.querySelector('[data-testid=signal-row]').click(); new Promise(r=>setTimeout(()=>r([...document.querySelectorAll('[data-testid=signal-panel] header span')].map(s=>s.innerText.trim())),200))`)
  ok('the certainty tag in the code panel starts “Certainty:”', head.some((h) => /^Certainty: /.test(h)), head)
  await b.goto(`${root}/report/themes-map`); await b.waitFor('Theme map'); await b.sleep(1200)
  const tm = await b.evaluate(`[...document.querySelectorAll('[data-testid=verdict-chip]')].map(e=>e.innerText.trim())`)
  ok('the Theme map’s verdict chips use the shared labels too', tm.every((c) => LABELS.includes(c)), tm)
} catch (e) {
  failures.push(`crashed: ${e.message}`)
}
await b.close?.()
console.log(failures.length ? `a2-theme-panel FAILED (${checks.length} checks):\n- ${failures.join('\n- ')}` : `a2-theme-panel ${checks.length} checks OK`)
process.exit(failures.length ? 1 : 0)
