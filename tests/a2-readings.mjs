// A2's output: one reading per theme. The label rules and their edges, the statement and its validator, the Researcher's decision
// (accept, edit with numbers locked, change label with a reason, leave out), Out of date when the counts move, and the cleaned-up table.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-readings.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
let n = 0
const ok = (label, cond, detail) => {
  n++
  if (!cond) failures.push(detail ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const q = (s) => JSON.stringify(s)
const text = (sel) => b.evaluate(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ').trim() ?? null`)
const all = (sel) => b.evaluate(`[...document.querySelectorAll(${q(sel)})].map(e=>e.innerText.replace(/\\s+/g,' ').trim())`)
const click = async (sel) => {
  const done = await b.poll(`(()=>{const e=document.querySelector(${q(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel}`)
  await b.sleep(350)
}
const setVal = (sel, v, proto = 'HTMLTextAreaElement', i = 0) => b.evaluate(`(()=>{const t=document.querySelectorAll(${q(sel)})[${i}];Object.getOwnPropertyDescriptor(${proto}.prototype,'value').set.call(t,${q(v)});t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}));return true})()`).then(() => b.sleep(200))
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
const doc = () => b.evaluate(`Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]`)
const pickTheme = async (name) => { await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].find(r=>r.querySelector('.font-semibold').innerText.trim()===${q(name)}).click(); true`); await b.sleep(300) }
const rowOf = (name) => b.evaluate(`(()=>{const r=[...document.querySelectorAll('[data-testid=theme-row]')].find(r=>r.querySelector('.font-semibold').innerText.trim()===${q(name)});return r?{status:r.dataset.status,label:r.dataset.label,}:null})()`)
const footer = () => text('[data-testid=report-footer-count]')

try {
  await b.goto('/researcher')
  await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(600)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-suggestion]')].forEach(s=>s.querySelector('[data-testid=accept-theme]').click()); true`); await b.sleep(700)
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(900)

  // ── The label rules, with their edges ──
  const u = await withMod(`(async()=>{
    const tr = await window.__mod('/src/state/themeReadings')
    const nar = await window.__mod('/src/state/narration')
    const N = (o) => ({ n: 10, R: 8, P: 0, U: 0, M: 8, positive: 8, negative: 0, facts: 0, audio: 0, faces: 8, hesitated: 0, backed: 0, confused: 0, ...o })
    const C = (name, verdict, R, o = {}) => ({ id: name, name, verdict, R, P: 0, U: 0, M: R, ...o })
    const r = (nums, codes = [], tensions = []) => tr.readingFrom({ nums: N(nums), codes, tensions })
    const out = {
      stated: r({ R: 0, M: 0, positive: 0, negative: 0, facts: 6, n: 6 }),
      few: r({ R: 2, M: 2, positive: 2 }),
      split: r({ R: 9, M: 4, P: 4, U: 1 }, [C('Skip', 'Consistent', 3, { M: 3 }), C('Flex', 'Conflicting', 3, { M: 0, P: 3 })]),
      noSplit: r({ R: 9, M: 4, P: 4, U: 1 }, [C('Skip', 'Consistent', 3, { M: 3 }), C('Flex', 'Conflicting', 2, { M: 0, P: 2 })]),
      meant: r({ R: 8, M: 5, P: 2, U: 1 }, [C('A', 'Mixed', 4, { M: 2, P: 2 })]),
      halfMeant: r({ R: 8, M: 4, P: 3, U: 1 }),
      notBacked: r({ R: 8, M: 2, P: 5, U: 1 }),
      halfAgainst: r({ R: 8, M: 2, P: 4, U: 2 }),
      unsure: r({ R: 6, M: 2, P: 1, U: 3, hesitated: 3 }),
      unsureNoP: r({ R: 6, M: 2, P: 0, U: 4 }),
      partlyNoU: r({ R: 6, M: 3, P: 3, U: 0 }),
      complaint: r({ R: 5, M: 4, P: 1, positive: 0, negative: 5 }),
      both: r({ R: 5, M: 4, P: 1, positive: 3, negative: 2 }),
      hes: r({ R: 9, M: 5, P: 1, U: 3, hesitated: 3 }),
      tension: r({ R: 8, M: 5, P: 3 }, [], [{ id: 't1', title: 'Chose the pause idea in the end, but hesitated when first shown it' }]),
    }
    const lines = Object.values(out).flatMap((x) => x.lines)
    return { out: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { label: v.label, lines: v.lines, problems: v.problems, coverage: v.coverage }])), bad: lines.filter((l) => !nar.checkNarration(l, { maxWords: 40, figuresAllowed: 3 }).ok),
      edit: { same: tr.editProblems(['Of the 8 who took a position, 5 had delivery that fit the words.'], ['Of the 8 who took a position, 5 fit the words.']), changed: tr.editProblems(['Of the 8 who took a position, 5 had delivery that fit the words.'], ['Of the 9 who took a position, 5 fit the words.']), pct: tr.editProblems(['5 of 8 people.'], ['5 of 8 people, 62%.']) } }
  })()`)
  const o = u.out
  const ACC = (R, M, P, U) => `Of the ${R} who took a position, ${[M ? `${M} had delivery that fit the words` : '', P ? `${P} didn’t fit` : '', U ? `${U} ${U === 1 ? 'was' : 'were'} unsure` : ''].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
  ok('nobody took a position: “Facts only”, with the plain line and no others', o.stated.label === 'Stated, not argued' && o.stated.lines.length === 1 && /^All 6 described what happened\. Nobody took a position, so there is no delivery to test\.$/.test(o.stated.lines[0]), o.stated)
  ok('fewer than 3 took a position: “Too few to read”', o.few.label === 'Too few to read' && o.few.lines[0] === 'Only 2 of 10 took a position with a readable delivery.', o.few)
  ok('a Fits code and a Doesn’t fit code, each with 3 readable people: “Split”, line 1 accounts for everyone and line 2 names both', o.split.label === 'Split inside the theme' && o.split.lines[0] === ACC(9, 4, 4, 1) && o.split.lines[1] === '“Skip” fits (3 of 3); “Flex” doesn’t fit (3 of 3).', o.split)
  ok('a Doesn’t fit code with only 2 readable people does not split the theme', o.noSplit.label !== 'Split inside the theme', o.noSplit.label)
  ok('more than half fit: “Fits”, and line 1 gives fit, didn’t fit and unsure', o.meant.label === 'Said and meant' && o.meant.lines[0] === ACC(8, 5, 2, 1), o.meant)
  ok('exactly half fit is never “more than half”', o.halfMeant.label !== 'Said and meant', o.halfMeant.label)
  ok('more than half didn’t fit: “Doesn’t fit”', o.notBacked.label === 'Said, not backed' && o.notBacked.lines[0] === ACC(8, 2, 5, 1), o.notBacked)
  ok('exactly half didn’t fit is “Partly fits” (P at least U)', o.halfAgainst.label === 'Partly backed' && o.halfAgainst.lines[0] === ACC(8, 2, 4, 2), o.halfAgainst)
  ok('more unsure than didn’t fit: “Unsure”', o.unsure.label === 'Said, but unsure' && o.unsure.lines[0] === ACC(6, 2, 1, 3), o.unsure)
  ok('only zeros are left out, and the row total is always R', [o.meant, o.notBacked, o.halfAgainst, o.unsure, o.unsureNoP, o.partlyNoU].every((x) => { const m = [...x.lines[0].matchAll(/(\d+) (?:had|didn’t|was|were)/g)].reduce((a, y) => a + +y[1], 0); return m === Number(x.lines[0].match(/Of the (\d+)/)[1]) && !/ 0 /.test(x.lines[0]) }), [o.unsureNoP.lines[0], o.partlyNoU.lines[0]])
  ok('the words are “took a position” and “fit”, never “meant it”, “argued for it” or “complained”', Object.values(o).every((x) => !/meant it|argued for it|complained|pulled against/.test(x.lines.join(' '))), Object.values(o).map((x) => x.lines[0]))
  ok('the gap line names the code where people didn’t fit their words', o.meant.lines[1] === 'The gap sits in “A”: 2 of the 4 who took a position didn’t fit their words.', o.meant.lines)
  ok('the hesitation line shows when a third or more hesitated', o.hes.lines.some((l) => l === '3 of 9 hesitated while saying it.') && !o.unsure.lines.some((l) => /hesitated while saying it/.test(l)), [o.hes.lines, o.unsure.lines])
  ok('an accepted tension adds “Related tension: …”', o.tension.lines.some((l) => l === 'Related tension: Chose the pause idea in the end, but hesitated when first shown it.'), o.tension.lines)
  ok('at most three lines, and every line passes the shared validator (no percentages, n of N)', Object.values(o).every((x) => x.lines.length <= 3 && x.problems.length === 0) && u.bad.length === 0 && !Object.values(o).some((x) => /%/.test(x.lines.join(' '))), u.bad)
  ok('coverage sits apart from the statement, never inside it', Object.values(o).every((x) => !x.lines.some((l) => /audio-only|faces read for|only stated a fact/.test(l))))
  ok('an edit that keeps the numbers can be saved; changing a number or adding a percentage cannot', u.edit.same.length === 0 && u.edit.changed.some((p) => /numbers are locked/.test(p)) && u.edit.pct.some((p) => /percentage/.test(p)), u.edit)

  // ── In the app: nothing accepted on its own; suggested tensions never in a statement ──
  const rows = await all('[data-testid=theme-row]')
  ok('one row per theme, all Suggested on arrival: nothing is accepted on its own', rows.length === 4 && (await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].every(r=>r.dataset.status==='Suggested')`)), rows)
  const seen = await withMod(`(async()=>{const cb=await window.__mod('/src/state/codebook');const ms=await window.__mod('/src/mock/signals');const sess=await window.__mod('/src/mock/sessions');const sg=await window.__mod('/src/state/signals');const tr=await window.__mod('/src/state/themeReadings');const doc=Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0];const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'));const basis=cb.basisOf(ms.ACCEPTED_PARTICIPANTS.map(p=>({id:sid(p),participantId:p})));const ts=sg.tensionsOf(doc,basis);const out=[];sg.themeSignals(doc,basis).filter(t=>t.kind==='theme').forEach(t=>{const r=tr.readingOf(t,doc,ts);const mine=tr.tensionsOfTheme(t,ts);out.push({name:t.name,lines:r.lines,suggested:mine.filter(x=>x.status!=='Added as a tension theme').map(x=>x.title),accepted:mine.filter(x=>x.status==='Added as a tension theme').map(x=>x.title),R:r.nums.R,fitN:t.fit.n,P:r.nums.P,against:t.fit.against})});return out})()`)
  ok('a suggested tension never appears in a statement; an accepted one does', seen.every((s) => s.suggested.every((t) => !s.lines.join(' ').includes(t))) && seen.some((s) => s.accepted.length && s.accepted.every((t) => s.lines.join(' ').includes(t.replace(/\.$/, '')))), seen)
  ok('the counts are A2’s own theme counts, not recomputed', seen.every((s) => s.R === s.fitN && s.P === s.against))

  // ── The table ──
  ok('one header: Name, Said by, Face, Speech, Words vs delivery, Status; How it’s decided, Key and Expand all are in the toolbar', (await b.evaluate(`document.querySelectorAll('[data-testid=signal-head]').length`)) === 1 && /^Name Said by Face Speech Words vs delivery Status$/.test((await text('[data-testid=signal-head]')) ?? '') && (await b.evaluate(`!!document.querySelector('[data-testid=how-decided]') && !!document.querySelector('[data-testid=key]') && !document.querySelector('[data-testid=signal-head] [data-testid=key]')`)), await text('[data-testid=signal-head]'))
  ok('theme rows are collapsed by default, and there is no sentence in any row', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-codes]').length`)) === 0 && (await b.evaluate(`document.querySelectorAll('[data-testid=theme-line]').length`)) === 0)
  ok('there is no Tension themes group, no legend strip and no grouping paragraph on the page', !(await b.evaluate(`[...document.querySelectorAll('h3')].some(h=>/Tension themes/.test(h.innerText))`)) && (await b.evaluate(`document.querySelectorAll('[data-testid=valence-key]').length`)) === 0 && !/Grouped as/.test((await text('main')) ?? ''))
  await click('[data-testid=key]')
  ok('the Key popover holds the face, tone and certainty colours and the grouping', (await b.evaluate(`!!document.querySelector('[data-testid=key-pop] [data-testid=valence-key]')`)) && /Face/.test((await text('[data-testid=key-pop]')) ?? '') && /certainty/i.test((await text('[data-testid=key-pop]')) ?? ''))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(200)
  await click('[data-testid=expand-all]')
  ok('Expand all opens every theme’s codes, read-only (no switches)', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-codes]').length`)) === 4 && (await b.evaluate(`document.querySelectorAll('[data-testid=theme-codes] [role=switch], [data-testid=theme-codes] input').length`)) === 0)
  const faces = await all('[data-testid=face-cell]')
  const speech = await all('[data-testid=speech-label]')
  ok('Face cells use polarity with a base (“2 of 3 positive”), “All neutral” or “No clear lead”: never “Mixed”, never a lead of Neutral', faces.length >= 8 && faces.every((f) => !/Mixed|^Neutral/.test(f) && /^(\d+ of \d+ (positive|negative|confused)|All neutral|No clear lead|No faces read|—)$/.test(f)), faces)
  ok('Speech cells are “n of N flat or tense” or “None flat or tense”', speech.length >= 8 && speech.every((f) => /^(\d+ of \d+ flat or tense|None flat or tense|—)$/.test(f)), speech)
  ok('no inline “In report” or “Nothing to show” tags next to code names', (await b.evaluate(`document.querySelectorAll('[data-testid=row-state]').length`)) === 0 && !/Nothing to show/.test((await text('[aria-label="Theme readings"]')) ?? ''))
  ok('code verdicts are a dot and words from the one label map, and nothing else is in that column', (await all('[data-testid=fit-cell]')).every((f) => /^(Fits|Partly fits|Doesn’t fit|Unsure|Split|Facts only|Too few to read)$/.test(f)) && (await b.evaluate(`document.querySelectorAll('[data-testid=fit-cell] .rounded-full').length`)) > 5)
  ok('“Said by” explains N when it is not the full sample', /people who were asked this question/.test((await b.evaluate(`document.querySelector('[data-testid=said-by-head]').title`)) ?? ''))

  // ── Every figure is traceable: tiles equal the named people, each person is in one bucket ──
  const names4 = ['Price creep', 'The pet decides', 'Wanting control over deliveries', 'Why they joined']
  const trace = []
  for (const name of names4) {
    await pickTheme(name)
    const t = await b.evaluate(`(()=>{const n=(k)=>+document.querySelector('[data-testid=tile-'+k+']').dataset.n;const rows=[...document.querySelectorAll('[data-testid=theme-panel] [data-testid=person-row]')];const ids=rows.map(r=>r.dataset.person);return {a:n('against'),u:n('unsure'),f:n('fit'),ra:rows.filter(r=>r.dataset.bucket==='against').length,ru:rows.filter(r=>r.dataset.bucket==='unsure').length,rf:rows.filter(r=>r.dataset.bucket==='fit').length,dup:ids.length-new Set(ids).size,reasons:rows.every(r=>r.querySelector('[data-testid=person-reason]').innerText.trim().length>3),backed:+(document.querySelector('[data-testid=tile-backed]')?.innerText.match(/^\d+/)?.[0] ?? -1),line:document.querySelector('[data-testid=reading-statement] p').innerText}})()`)
    const R = Number(t.line.match(/Of the (\d+)|All (\d+)|Only (\d+)/).slice(1).find(Boolean))
    trace.push({ name, ...t, R })
  }
  ok('each tile equals the number of named people listed for it, and the three add up to R', trace.every((t) => t.a === t.ra && t.u === t.ru && t.f === t.rf && t.a + t.u + t.f === t.R), trace)
  ok('nobody is in two buckets, and every person has a plain reason', trace.every((t) => t.dup === 0 && t.reasons))
  ok('“with a positive signal” is part of the fits and never more than them', trace.every((t) => t.backed <= t.f))
  await b.evaluate(`document.querySelector('[data-testid=tile-against]').click(); true`); await b.sleep(200)
  ok('clicking a tile filters the people list to that bucket', await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-panel] [data-testid=person-row]')].every(r=>r.dataset.bucket==='against')`))
  await b.evaluate(`document.querySelector('[data-testid=tile-against]').click(); true`)
  const logic = await withMod(`(async()=>{
    const sg = await window.__mod('/src/state/signals')
    const lab = await window.__mod('/src/config/labels')
    const doc = { faceFixes: {} }
    const mk = (key, o = {}) => ({ key, participantId: 'P-1', sessionId: 'S', pet: 'Dog', atSec: 1, facts: { delaySec: 1, pauseSec: 0, fillers: 0 }, usual: 1, band: o.band ?? 'Steady', reason: 'r', voice: { tone: o.tone ?? 'Even', pace: 1, usualPace: 1, pitch: 1, usualPitch: 1, loudness: 0, reason: 'v' }, stance: 'Positive', face: o.face === null ? undefined : { emotion: o.face ?? 'Neutral', intensity: 'Medium', confidence: 0.8, cue: 'c', onsetSec: 1 } })
    const one = (moments) => sg.personReads(moments, doc)
    return {
      tie: one([mk('a', { tone: 'Flat' }), mk('b')]).map((r) => r.bucket),
      against: one([mk('a', { tone: 'Flat' }), mk('b', { tone: 'Tense' }), mk('c')]).map((r) => r.bucket),
      fit: one([mk('a'), mk('b'), mk('c', { tone: 'Flat' })]).map((r) => r.bucket),
      onlyPauses: one([mk('a', { band: 'Marked hesitation' })]).map((r) => [r.bucket, r.reason]),
      confusion: one([mk('a', { face: 'Confusion' })]).map((r) => r.bucket),
      two: one([mk('a', { tone: 'Flat' }), mk('b'), mk('c', { tone: 'Flat' })]).length,
      backed: one([mk('a', { tone: 'Animated' })]).map((r) => [r.bucket, r.positive, r.reason]),
      plain: one([mk('a')]).map((r) => [r.bucket, r.positive, r.reason]),
      words: lab.VERDICT_WORDS, reading: lab.READING_WORDS,
    }
  })()`)
  ok('more than half of a person’s moments against: didn’t fit; more than half fit: fits; a tie is unsure', JSON.stringify(logic.against) === '["against"]' && JSON.stringify(logic.fit) === '["fit"]' && JSON.stringify(logic.tie) === '["unsure"]', logic)
  ok('only long pauses is unsure, with that plain reason', JSON.stringify(logic.onlyPauses) === '[["unsure","long pauses only"]]', logic.onlyPauses)
  ok('Confusion never counts for or against: a confused face fits', JSON.stringify(logic.confusion) === '["fit"]')
  ok('a person with several moments is one row, not several', logic.two === 1)
  ok('a fit person is “backed” by an animated voice, otherwise “nothing contradicted”', JSON.stringify(logic.backed) === '[["fit",true,"animated voice"]]' && JSON.stringify(logic.plain) === '[["fit",false,"nothing contradicted"]]', [logic.backed, logic.plain])
  const chips = await all('[data-testid=reading-chip]')
  ok('every reading chip and verdict on the page reads from the one label map', chips.every((c) => Object.values(logic.reading).includes(c)) && (await all('[data-testid=verdict]')).every((c) => Object.values(logic.words).includes(c)), [chips, logic.words])
  ok('the label map is the one wording: Fits, Partly fits, Doesn’t fit, Unsure, Split, Too few to read, Facts only', JSON.stringify([logic.reading['Said and meant'], logic.reading['Partly backed'], logic.reading['Said, not backed'], logic.reading['Said, but unsure'], logic.reading['Split inside the theme'], logic.reading['Too few to read'], logic.reading['Stated, not argued']]) === JSON.stringify(['Fits', 'Partly fits', 'Doesn’t fit', 'Unsure', 'Split', 'Too few to read', 'Facts only']) && logic.words.Consistent === logic.reading['Said and meant'] && logic.words.Conflicting === logic.reading['Said, not backed'])
  ok('no percentages anywhere in the panel', !/%/.test((await text('[data-testid=theme-panel]')) ?? ''))

  // ── The grid: one header, aligned columns, rows that don't overflow (every theme is open from the Expand all above) ──
  const grid = await b.evaluate(`(()=>{const x=(el)=>Math.round(el.getBoundingClientRect().right);const th=document.querySelector('[data-testid=theme-row]');const cd=document.querySelector('[data-testid=signal-row]');const sb=(row)=>x(row.children[1]);return {themeSaid:sb(th),codeSaid:sb(cd),themeFace:Math.round(th.children[2].getBoundingClientRect().left),codeFace:Math.round(cd.children[2].getBoundingClientRect().left),themeH:Math.round(th.getBoundingClientRect().height),codeH:Math.round(cd.getBoundingClientRect().height)}})()`)
  ok('Said by and Face sit at the same x in theme rows and code rows', grid.themeSaid === grid.codeSaid && grid.themeFace === grid.codeFace, grid)
  ok('theme rows are the 56px light-grey band; code rows are 44px', grid.themeH === 56 && grid.codeH === 44, grid)
  ok('no cell text is clipped or overlaps its neighbour (verdict text, labels)', await b.evaluate(`[...document.querySelectorAll('[data-testid=face-cell],[data-testid=speech-label],[data-testid=fit-cell],[data-testid=reading-chip],[data-testid=tension-chip],[data-testid=status-chip]')].every(e=>e.scrollWidth<=e.clientWidth+1)`))
  ok('code names truncate with a tooltip, and a code in two themes would carry a small icon instead of a sentence', await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row] span.truncate.font-medium')].every(e=>e.title===e.innerText) && !/Also in/.test(document.querySelector('[data-testid=theme-codes]').innerText)`))
  const tens = await all('[data-testid=tension-chip]')
  ok('the tension chip sits beside the theme name (“4 codes · ⚑ 4 tensions”), with an amber dot when any wait for review, and is absent when there are none', tens.length >= 2 && tens.every((x) => /^⚑ \d+ tensions?$/.test(x)) && (await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-dot]')].every(d=>/^\\d+ to review$/.test(d.title))`)) && (await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].some(r=>!r.querySelector('[data-testid=tension-chip]'))`)) && (await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-meta]')].every(m=>/^\\d+ codes?/.test(m.innerText))`)), tens)
  ok('the three-part bar sits in the Words vs delivery cell at both levels, with its counts in the tooltip and aria-label, and no stacked numbers', (await b.evaluate(`[...document.querySelectorAll('[data-testid=reading-bar]')].every(e=>/^\\d+ didn’t fit · \\d+ unsure · \\d+ fit$/.test(e.getAttribute('aria-label')) && e.title===e.getAttribute('aria-label') && [...e.children].reduce((a,c)=>a+Number(c.dataset.n),0)===Number(e.dataset.base))`)) && (await b.evaluate(`document.querySelectorAll('[data-testid=fit-cell] [data-testid=reading-bar]').length`)) > 8 && !(await b.evaluate(`/\\d · \\d · \\d/.test(document.querySelector('[data-testid=theme-list]').innerText)`)))
  await click('[data-testid=expand-all]')
  ok('Expand all becomes Collapse all, and collapsing closes every theme', (await text('[data-testid=expand-all]')) === 'Expand all' && (await b.evaluate(`document.querySelectorAll('[data-testid=theme-codes]').length`)) === 0)
  await click('[data-testid=expand-all]')
  ok('every Face and Speech cell has a 64×8 mini bar, at theme and code level, whose segments add up to the base in its label', await b.evaluate(`(()=>{const cells=[...document.querySelectorAll('[data-testid=face-cell],[data-testid=speech-label]')].filter(e=>e.innerText!=='—');if(cells.length<16)return false;return cells.every(c=>{const bar=c.parentElement.querySelector('[data-testid=mini-bar]');if(!bar)return false;const r=bar.getBoundingClientRect();const sum=[...bar.children].reduce((a,x)=>a+Number(x.dataset.n),0);const base=Number(bar.dataset.base);const lab=bar.getAttribute('aria-label');return Math.round(r.width)===64&&Math.round(r.height)===8&&sum===base&&(base===0||/of \\d+/.test(lab))&&bar.title===lab&&[...bar.children].every(x=>x.getBoundingClientRect().width>=2.9)})})()`))
  ok('the face label’s base equals its bar’s base, and the speech label’s base equals its tones', await b.evaluate(`[...document.querySelectorAll('[data-testid=face-cell],[data-testid=speech-label]')].filter(e=>/\\d+ of \\d+/.test(e.innerText)).every(c=>{const bar=c.parentElement.querySelector('[data-testid=mini-bar]');return Number(c.innerText.match(/of (\\d+)/)[1])===Number(bar.dataset.base)})`))
  ok('Face bars are by polarity and Speech bars by tone: different colours for positive, neutral, negative and unclear', await b.evaluate(`(()=>{const f=document.querySelector('[data-testid=face-cell]').parentElement.querySelector('[data-testid=mini-bar]');return /positive.*neutral.*negative.*unclear/.test(f.getAttribute('aria-label'))})()`) && await b.evaluate(`/animated.*even.*flat.*tense/.test(document.querySelector('[data-testid=speech-label]').parentElement.querySelector('[data-testid=mini-bar]').getAttribute('aria-label'))`))
  const cues = await all('[data-testid=claim-cue]')
  ok('a claim cue follows every theme name (“mostly complaint”, “mostly for it”, “mixed”) and every code name (“complaint”, “for it”, “facts”)', cues.length >= 16 && cues.filter((c) => /^· (mostly complaint|mostly for it|mixed)$/.test(c)).length === 4 && cues.filter((c) => /^· (complaint|for it|facts)$/.test(c)).length === cues.length - 4, cues)
  ok('the Face header says “A negative face fits a complaint.”, and so does the Key', (await b.evaluate(`document.querySelector('[data-testid=face-head]').title`)) === 'A negative face fits a complaint.')
  await click('[data-testid=key]')
  ok('the Key carries the same line', /A negative face fits a complaint\./.test((await text('[data-testid=key-pop]')) ?? ''))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(150)
  ok('Accept exists only on Suggested theme rows, inside the Status area, never on a code row', await b.evaluate(`(()=>{const btns=[...document.querySelectorAll('[data-testid=row-accept]')];return btns.length===document.querySelectorAll('[data-testid=theme-row][data-status=Suggested]').length&&btns.every(x=>!x.closest('[data-testid=theme-codes]')&&x.parentElement.querySelector('[data-testid=theme-row]')&&getComputedStyle(x).right==='12px')&&document.querySelectorAll('[data-testid=signal-row] [data-testid=row-accept]').length===0})()`))
  for (const [w, h] of [[1280, 900], [1440, 1000]]) {
    await b.viewport(w, h); await b.sleep(400)
    ok(`no Face, Speech, verdict, chip or status text is clipped at ${w}px`, await b.evaluate(`[...document.querySelectorAll('[data-testid=face-cell],[data-testid=speech-label],[data-testid=fit-cell],[data-testid=reading-chip],[data-testid=status-chip],[data-testid=verdict]')].every(e=>e.scrollWidth<=e.clientWidth+1&&getComputedStyle(e).textOverflow!=='ellipsis')`))
    ok(`no row grows from wrapping at ${w}px: theme rows 56px, code rows 44px`, await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].every(r=>Math.round(r.getBoundingClientRect().height)===56)&&[...document.querySelectorAll('[data-testid=signal-row]')].every(r=>Math.round(r.getBoundingClientRect().height)===44)`))
  }
  await b.viewport(1440, 1000); await b.sleep(300)
  // Hover Accept and the keyboard
  await pickTheme('Price creep')
  const hov = await b.evaluate(`(()=>{const li=[...document.querySelectorAll('[data-testid=theme-item]')].find(l=>/Price creep/.test(l.innerText));const btn=li.querySelector('[data-testid=row-accept]');return {has:!!btn,cls:btn?.className.includes('group-hover:inline-flex'),hidden:getComputedStyle(btn).display==='none',statusHides:li.querySelector('[data-testid=theme-status]').className.includes('group-hover:invisible')}})()`)
  ok('a Suggested row has a small primary Accept that appears on hover, in place of the status chip', hov.has && hov.cls && hov.hidden && hov.statusHides, hov)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-item]')].find(l=>/The pet decides/.test(l.innerText)).querySelector('[data-testid=row-accept]').click(); true`); await b.sleep(400)
  ok('clicking it accepts that reading', (await rowOf('The pet decides')).status === 'Accepted')
  await pickTheme('Price creep')
  await b.evaluate(`document.querySelector('[data-testid=theme-row][aria-current=true]').focus(); true`)
  const key = (k) => b.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:${q(k)},bubbles:true})); true`).then(() => b.sleep(350))
  await key('ArrowDown')
  ok('Up and Down move between themes', /The pet decides/.test((await text('[data-testid=theme-panel] h2')) ?? ''))
  await key('ArrowUp')
  await key('e')
  ok('E opens the editor for the open theme', (await b.evaluate(`!!document.querySelector('[data-testid=reading-editor]')`)))
  await click('[data-testid=reading-edit-save] + button')
  await b.evaluate(`document.querySelector('[data-testid=theme-row][aria-current=true]').focus(); true`)
  await key('l')
  ok('L opens Leave out', (await b.evaluate(`!!document.querySelector('[data-testid=leave-editor]')`)))
  await click('[data-testid=leave-editor] button + button')
  await b.evaluate(`document.querySelector('[data-testid=theme-row][aria-current=true]').focus(); true`)
  await key('a')
  ok('A accepts the open theme', (await rowOf('Price creep')).status === 'Accepted')
  const clearReadings = () => b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];delete o[id].readings;localStorage[k]=JSON.stringify(o);return true})()`)
  await clearReadings()
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(800)
  // Review mode: the footer button opens the first Suggested theme and steps through with Accept and next
  await click('[data-testid=lead-action]')
  ok('“Review 4 readings” opens the first Suggested theme in review mode with “Accept and next”, 1 of 4', /^Review 4 readings$/.test('Review 4 readings') && /1 of 4/.test((await text('[data-testid=reading-accept-next]')) ?? ''), await text('[data-testid=reading-accept-next]'))
  const first = await text('[data-testid=theme-panel] h2')
  await click('[data-testid=reading-accept-next]')
  ok('Accept and next accepts it and moves to the next Suggested theme, now 1 of 3', first !== (await text('[data-testid=theme-panel] h2')) && /1 of 3/.test((await text('[data-testid=reading-accept-next]')) ?? ''), await text('[data-testid=reading-accept-next]'))
  await click('[data-testid=reading-accept-next]'); await click('[data-testid=reading-accept-next]'); await click('[data-testid=reading-accept-next]')
  ok('after the last one review mode ends and every reading is accepted', (await b.evaluate(`document.querySelectorAll('[data-testid=reading-accept-next]').length`)) === 0 && (await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].every(r=>r.dataset.status==='Accepted')`)))
  await clearReadings()
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(800)

  // ── Accept: who, when and version; goes to the report count ──
  await pickTheme('Why they joined')
  ok('the theme panel shows the statement with the AI-suggested tag, the actions and three tiles', /AI-suggested/.test((await text('[data-testid=reading-tag]')) ?? '') && (await b.evaluate(`['against','unsure','fit'].every(k=>document.querySelector('[data-testid=tile-'+k+']'))`)) && /All 9 who took a position had delivery that fit the words\./.test((await text('[data-testid=reading-statement]')) ?? ''), await text('[data-testid=reading-statement]'))
  ok('the footer starts at 0 readings', /^Goes to the report: 0 readings and \d+ tension themes?/.test((await footer()) ?? ''), await footer())
  await click('[data-testid=reading-accept]')
  const d1 = (await doc()).readings
  const why = Object.values(d1)[0]
  ok('Accept records who, when and the data version', why && why.status === 'Accepted' && why.by === 'Maya Ortiz' && !!why.at && why.version === 1 && !!why.fingerprint && why.sessions === 20, why)
  ok('the row says Accepted, the footer counts 1 theme reading, the approval footer names who and the version', (await rowOf('Why they joined')).status === 'Accepted' && /^Goes to the report: 1 reading /.test((await footer()) ?? '') && /^Accepted by Maya Ortiz · \d+ \w{3}, \d\d:\d\d · data v1$/.test((await text('[data-testid=approval-footer]')) ?? ''), await text('[data-testid=approval-footer]'))
  // ── Edit: wording only, numbers locked ──
  await pickTheme('Price creep')
  await click('[data-testid=reading-edit]')
  const orig = await b.evaluate(`document.querySelector('[data-testid=reading-edit-line]').value`)
  await setVal('[data-testid=reading-edit-line]', orig.replace(/, (\d+)/, (m, d) => `, ${+d + 1}`))
  ok('changing a number blocks Save', (await b.evaluate(`document.querySelector('[data-testid=reading-edit-save]').disabled`)) && /numbers are locked/.test((await text('[data-testid=reading-edit-problems]')) ?? ''), await text('[data-testid=reading-edit-problems]'))
  await setVal('[data-testid=reading-edit-line]', orig.replace('had delivery that fit the words', 'matched the words'))
  ok('rewording with the same numbers can be saved', !(await b.evaluate(`document.querySelector('[data-testid=reading-edit-save]').disabled`)))
  await click('[data-testid=reading-edit-save]')
  ok('saved: status Edited, tagged “Edited by Maya Ortiz”, the new wording shown', (await rowOf('Price creep')).status === 'Edited' && (await text('[data-testid=reading-tag]')) === 'Edited by Maya Ortiz' && /matched the words/.test((await text('[data-testid=reading-statement]')) ?? ''))
  // ── Change label: needs a reason ──
  await pickTheme('The pet decides')
  await click('[data-testid=reading-more]'); await click('[data-testid=reading-label]')
  await b.evaluate(`(()=>{const s=document.querySelector('[data-testid=label-select]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'Partly backed');s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); await b.sleep(200)
  ok('a label change cannot be saved without a reason', await b.evaluate(`document.querySelector('[data-testid=label-save]').disabled`))
  await setVal('[data-testid=label-why-input]', 'The one who pulled against is the vet case, which matters here.')
  await click('[data-testid=label-save]')
  const pet = Object.values((await doc()).readings).find((x) => x.label)
  ok('with a reason it saves: Label changed, the reason shown, the numbers unchanged and logged', (await rowOf('The pet decides')).status === 'Label changed' && (await rowOf('The pet decides')).label === 'Partly backed' && /Label changed from “Fits” by Maya Ortiz/.test((await text('[data-testid=label-why]')) ?? '') && pet.snap.M === Number(await b.evaluate(`document.querySelector('[data-testid=tile-fit]').dataset.n`)) && (await doc()).log.some((l) => l.action === 'Reading label changed' && l.why))
  // ── Note: separate ──
  await setVal('[data-testid=reading-note]', 'Probe the vet story in the next wave.')
  await click('[data-testid=reading-note-save]')
  ok('a researcher note is saved apart from the statement', (await doc()).readingNotes && Object.values((await doc()).readingNotes)[0].text === 'Probe the vet story in the next wave.' && !/Probe the vet/.test((await text('[data-testid=reading-statement]')) ?? '') && /Researcher’s note · Maya Ortiz/.test((await text('[data-testid=reading-note-by]')) ?? ''))
  // ── Needs review ──
  await click('[data-testid=show-review]')
  ok('“Needs review” shows only the Suggested and Out of date readings', JSON.stringify(await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].map(r=>r.dataset.status)`)) === JSON.stringify(['Suggested']))
  await pickTheme('Wanting control over deliveries')
  await click('[data-testid=reading-accept]')
  ok('accepting the last one empties it', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-row]').length`)) === 0 && /Every reading has a decision/.test((await text('main')) ?? ''))
  await click('[data-testid=show-all]')
  // ── Out of date: an input changes after acceptance ──
  const before = await rowOf('Wanting control over deliveries')
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(600)
  const added = await b.evaluate(`(()=>{const c=[...document.querySelectorAll('[data-testid=tension-card][data-status=Suggested]')].find(c=>/flexib|control|skip|pause|schedule/i.test(c.innerText)&&c.querySelector('[data-testid=turn-theme]'));if(!c)return null;c.querySelector('[data-testid=turn-theme]').click();return c.querySelector('h3').innerText})()`)
  await b.sleep(400); if (added) await click('[data-testid=turn-confirm]')
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(800)
  const after = await rowOf('Wanting control over deliveries')
  ok('adding a tension that touches an accepted reading marks it Out of date; nothing is rewritten silently', !!added && before.status === 'Accepted' && after.status === 'Out of date', { added, before, after })
  await pickTheme('Wanting control over deliveries')
  ok('Out of date shows the old and the new values, with Re-accept and Leave out', /^Was .+: \d+ fit, \d+ didn’t fit, \d+ unsure of \d+\. Now .+: \d+ fit, \d+ didn’t fit, \d+ unsure of \d+\.$/.test((await text('[data-testid=old-new]')) ?? '') && (await text('[data-testid=reading-accept]')) === 'Re-accept' && !(await b.evaluate(`document.querySelector('[data-testid=reading-leave]').disabled`)), await text('[data-testid=old-new]'))
  ok('the new statement already names the added tension', (await text('[data-testid=reading-statement]'))?.includes(`Related tension: ${added?.replace(/\.$/, '')}`), await text('[data-testid=reading-statement]'))
  await click('[data-testid=reading-accept]')
  const ctl = Object.values((await doc()).readings).find((x) => x.aiLines.join(' ').includes(added?.replace(/\.$/, '') ?? '§'))
  ok('re-accepting records a new data version', ctl?.version === 2 && (await rowOf('Wanting control over deliveries')).status === 'Accepted', ctl)
  // ── Leave out ──
  await pickTheme('Why they joined')
  await click('[data-testid=reading-leave]')
  await setVal('[data-testid=leave-why]', 'Background, not a finding.')
  await click('[data-testid=leave-save]')
  ok('Leave out: reviewed, not reported, with the optional reason', (await rowOf('Why they joined')).status === 'Left out' && /Left out by Maya Ortiz .*“Background, not a finding\.”/.test((await text('[data-testid=approval-footer]')) ?? '') && /^Goes to the report: 3 readings /.test((await footer()) ?? ''), await footer())

  // ── The code panel ──
  await b.goto(`${root}/signals?view=code`); await b.waitFor('Words vs delivery'); await b.sleep(800)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>/Pause would have kept them/.test(r.innerText)).click(); true`); await b.sleep(300)
  ok('the code panel has no report switch, and the hesitant-delivery line sits inside the figures block', (await b.evaluate(`document.querySelectorAll('[data-testid=signal-panel] [role=switch]').length`)) === 0 && (await b.evaluate(`!!document.querySelector('[data-testid=delivery-breakdown] [data-testid=hesitant-note]')`)))
  await b.evaluate(`document.querySelector('[data-testid=code-details]').open = true; true`); await b.sleep(150)
  ok('the certainty line says “Certainty: …” and the origin is small grey text, both under Details', /^Certainty: /.test((await text('[data-testid=certainty-chip]')) ?? '') && /^Origin: (guide question|new code)$/.test((await text('[data-testid=origin]')) ?? ''))
  await click('[data-testid=code-theme-link]')
  ok('and leads back to its theme', /Wanting control over deliveries/.test((await text('[data-testid=theme-panel] h2')) ?? ''))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
}
b.close()
console.log(`${n} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 READINGS FAILED:\n - ' + failures.join('\n - '))
  process.exit(1)
}
console.log('A2 READINGS OK')
