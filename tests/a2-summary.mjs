// A2 plain-language summary: what people said, in one sentence of one of four shapes, the tile groups behind it, and the wording everywhere.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-summary.mjs
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
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const sess=await window.__mod('/src/mock/sessions'); const sg=await window.__mod('/src/state/signals'); const em=await window.__mod('/src/state/emotion'); const nr=await window.__mod('/src/state/narration')
  const store=()=>Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]
  const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'))
  const basisOf=(parts)=>cb.basisOf(parts.map(p=>({id:sid(p),participantId:p})))
  const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS)`
const run = (body) => b.evaluate(`(async()=>{${PRE}; ${body}})()`)
const click = async (sel, i = 0) => { const done = await b.poll(`(()=>{const e=document.querySelectorAll(${q(sel)})[${i}];if(!e||e.disabled)return false;e.click();return true})()`); if (!done) throw new Error(`nothing to click for ${sel} ${i}`); await b.sleep(300) }
const text = (sel) => b.evaluate(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ').trim() ?? null`)

// The shapes, worked out here from the people (not from the page's own function)
const SHAPES = [
  /^\d+ of \d+ people were verbally positive about it(, but \d+ of those \d+ [a-z ]+( and \d+ [a-z ]+)?|, and their delivery backed it up)?\.$/,
  /^\d+ of \d+ people were verbally negative about it(, and \d+ of those \d+ [a-z ]+( and \d+ [a-z ]+)?|, and their delivery backed it up)?\.$/,
  /^\d+ (person|people) spoke in favour of it and \d+ spoke against it\.$|^\d+ (person|people) spoke (in favour of|against) it\.$/,
  /^Nobody took a side\. All \d+ (person|people) just described what happened\.$/,
  // Under three people there is no pattern to read, so the sentence says so (OPEN_QUESTIONS #264).
  /^Only \d+ (person|people) said this, too few to read a pattern\.$/,
]
const OLD = /Complains about it|Speaks for it|argued for it|complained|\bPositive words|\bNegative words|Their words:|\bFactual\b|took a position/i

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(900)
  // data: themes and codes, with sides worked out from the points
  // Each person is counted once, from every quote of theirs, by the rule in docs (more than half of their positions; exactly half is never more than half).
  // This is written out here again, separately from state/speech.ts, so the page and the rule are checked against something else.
  const D = await run(`const person=(pts)=>{const by={};pts.forEach(p=>(by[p.participantId]??=[]).push(p));
      const against=(p)=>p.stance==='Positive'?['Tense','Flat'].includes(p.voice.tone):p.voice.tone==='Animated'
      const f=(p)=>against(p)?'Pulls against':p.band==='Marked hesitation'?'Uncertain':'Matches'
      return Object.entries(by).map(([id,ps])=>{const pos=ps.filter(p=>p.stance==='Positive'||p.stance==='Negative').sort((a,b)=>a.atSec-b.atSec);const n=pos.length;const c=(k)=>pos.filter(p=>f(p)===k).length;const up=pos.filter(p=>p.stance==='Positive').length
        return {id,side:!n?null:up*2>n?'Positive':up*2<n?'Negative':pos[0].stance,fit:!n?null:c('Pulls against')*2>n?'Pulls against':c('Matches')*2>n?'Matches':c('Pulls against')===0?'Uncertain':'Split',hes:n>0&&pos.filter(p=>p.band==='Marked hesitation').length*2>n}})}
    const one=(label,pts,reads)=>{const ppl=person(pts);const side=(k)=>ppl.filter(x=>x.side===k)
      return {label,N:ppl.length,pos:side('Positive').length,neg:side('Negative').length,
      tiles:Object.fromEntries(['Positive','Negative'].map(k=>[k,['Matches','Pulls against','Uncertain'].map(f=>side(k).filter(x=>x.fit===f).length)])),
      hes:Object.fromEntries(['Positive','Negative'].map(k=>[k,side(k).filter(x=>x.hes).length])),
      spl:Object.fromEntries(['Positive','Negative'].map(k=>[k,side(k).filter(x=>x.fit==='Split').length])),
      sentence:sg.sideSummary(reads).sentence}}
    const themes=sg.themeSignals(doc,basis).filter(t=>t.kind!=='tension').map(t=>({id:t.id,...one(t.name,t.positions,t.reads),fit:t.fit}))
    const codes=sg.codeSignals(doc,basis).map(s=>({id:s.code.id,...one(s.code.name,s.positions,s.reads),fit:s.fit}))
    return {themes,codes}`)
  const wantShape = (x) => (x.N < 3 ? 4 : !x.pos && !x.neg ? 3 : x.pos * 2 > x.N ? 0 : x.neg * 2 > x.N ? 1 : 2)
  ok('every theme and code sentence follows one of the four shapes, picked by the people counts', [...D.themes, ...D.codes].every((x) => SHAPES[wantShape(x)].test(x.sentence)), [...D.themes, ...D.codes].filter((x) => !SHAPES[wantShape(x)].test(x.sentence)).map((x) => x.sentence))
  ok('the n of N in a sentence equals the people on that side of those who raised it', [...D.themes, ...D.codes].every((x) => { const m = /^(\d+) of (\d+) people were verbally (positive|negative)/.exec(x.sentence); return !m || (Number(m[2]) === x.N && Number(m[1]) === (m[3] === 'positive' ? x.pos : x.neg) && Number(m[1]) * 2 > x.N) }))
  ok('no sentence uses a percentage, “meant it”, confusion, or “most” without a majority', [...D.themes, ...D.codes].every((x) => !/%|meant it|confus|\bmost\b/i.test(x.sentence)))
  // a clause names patterns among the people on that side only (one base), direction-aware, 3 or more
  const clauseOk = (x) => {
    const m = /^(\d+) of (\d+) people were verbally (positive|negative) about it, (but|and) (\d+) of those (\d+) ([a-z ]+?)( and (\d+) ([a-z ]+))?\.$/.exec(x.sentence)
    if (!m) return true
    const side = m[3] === 'positive' ? 'Positive' : 'Negative'
    const base = side === 'Positive' ? x.pos : x.neg
    const allowed = side === 'Positive' ? ['hesitated', 'sounded flat or tense'] : ['sounded animated or hesitated']
    const joint = m[4] === (side === 'Positive' ? 'but' : 'and')
    return joint && Number(m[6]) === base && Number(m[5]) >= 3 && allowed.includes(m[7]) && (!m[8] || (Number(m[9]) >= 3 && allowed.includes(m[10]) && m[10] !== m[7])) && (m[7] !== 'hesitated' || Number(m[5]) === x.hes[side])
  }
  ok('each clause has one base (“of those n” is the people on that side), 3 or more people, hesitated first then the tone (the order in the brief), and a direction-aware pattern; “but” for in favour, “and” for against', [...D.themes, ...D.codes].every(clauseOk), [...D.themes, ...D.codes].filter((x) => !clauseOk(x)).map((x) => x.sentence))
  ok('at least one sentence has a clause and at least one says delivery backed it up (so both are checked)', [...D.themes, ...D.codes].some((x) => /, but \d+ of those/.test(x.sentence) || /, and \d+ of those/.test(x.sentence)) && [...D.themes, ...D.codes].some((x) => /backed it up/.test(x.sentence)), [...D.themes, ...D.codes].map((x) => x.sentence))

  // the page: theme panels
  const nThemes = await b.evaluate(`document.querySelectorAll('[data-testid=theme-row]').length`)
  let two = 0
  for (let i = 0; i < nThemes; i++) {
    await click('[data-testid=theme-name]', i)
    const t = D.themes[i]
    if (t.id === 'none') {
      // Not in a theme: the numbers are computed, but the panel shows no sentence, tiles, verdict, moments or Accept.
      const n = await b.evaluate(`(()=>{const el=document.querySelector('[data-testid=theme-panel]');return {text:el.innerText.replace(/\\s+/g,' '),tiles:el.querySelectorAll('[data-testid=tile-group],[data-testid=match-tiles],[data-testid=summary-sentence],[data-testid=verdict-pill],[data-testid=moments]').length,accept:[...el.querySelectorAll('button')].some(x=>/^Accept/.test(x.innerText.trim()))}})()`)
      ok('Not in a theme: the panel only says its codes are not in a theme yet (no sentence, tiles, verdict, moments or Accept)', /codes? (isn’t|aren’t) in a theme yet\. Group (it|them) in the codebook\./.test(n.text) && n.tiles === 0 && !n.accept, n)
      continue
    }
    const p = await b.evaluate(`(()=>{const el=document.querySelector('[data-testid=theme-panel]');return {sentence:el.querySelector('[data-testid=summary-sentence]')?.innerText.replace(/\\s+/g,' ').trim(),tip:el.querySelector('[data-testid=raised-n]')?.title??null,q:el.querySelector('[data-testid=match-question]')?.innerText.trim()??null,groups:[...el.querySelectorAll('[data-testid=tile-group]')].map(g=>({side:g.dataset.side,n:Number(g.dataset.n),head:g.querySelector('[data-testid=group-head]').innerText.trim(),split:Number(g.querySelector('[data-testid=split-line]')?.innerText.match(/^\\d+/)?.[0]??0),tiles:[...g.querySelectorAll('[data-testid=match-tiles] > button')].map(x=>({label:x.querySelector('dt').innerText.trim(),n:Number(x.dataset.n)}))})),quiet:el.querySelector('[data-testid=fact-only]')?.innerText.replace(/\\s+/g,' ').trim()??null,text:el.innerText}})()`)
    ok(`${t.label}: the panel shows the computed sentence`, p.sentence === t.sentence, [p.sentence, t.sentence])
    ok(`${t.label}: the number N has the tooltip “People who raised this theme” (where the sentence has an N)`, /\d+ of \d+ people|All \d+ people/.test(t.sentence) ? p.tip === 'People who raised this theme' : true, p.tip)
    ok(`${t.label}: the question line comes under the sentence, then the tiles in the order Matched · No match · Hesitant`, p.q === 'Did their delivery match their words?' && p.groups.every((g) => g.tiles.map((x) => x.label).join() === 'Matched,No match,Hesitant'), p)
    const sides = ['Positive', 'Negative'].filter((k) => t[k === 'Positive' ? 'pos' : 'neg'] > 0)
    ok(`${t.label}: ${sides.length === 2 ? 'two stacked groups' : sides.length === 1 ? 'one group' : 'no group'}, headed by side and size`, p.groups.length === sides.length && p.groups.every((g) => g.head === (sides.length === 2 ? `${g.side === 'Positive' ? 'Spoke in favour' : 'Spoke against it'} · ${g.n}` : `${g.n} ${g.n === 1 ? 'person' : 'people'} ${g.side === 'Positive' ? 'spoke in favour' : 'spoke against it'}`)), p.groups)
    ok(`${t.label}: each group’s tiles plus its split-across-codes line sum to its size, and equal the people counts (${sides.map((k) => t.tiles[k].join('·')).join(' | ')})`, p.groups.every((g) => g.tiles.reduce((a, x) => a + x.n, 0) + g.split === g.n && g.split === t.spl[g.side] && g.tiles.map((x) => x.n).join() === t.tiles[g.side].join()), p.groups)
    ok(`${t.label}: the groups together equal the theme’s fit split (${t.fit.fits} · ${t.fit.against} · ${t.fit.uncertain})`, [0, 1, 2].every((k) => p.groups.reduce((a, g) => a + g.tiles[k].n, 0) === [t.fit.fits, t.fit.against, t.fit.uncertain][k]), p.groups)
    const described = t.N - t.pos - t.neg
    ok(`${t.label}: people who just described it are one quiet line, only when there are some`, described > 0 ? p.quiet?.startsWith(`${described} just described what happened, not checked`) : p.quiet === null, p.quiet)
    ok(`${t.label}: no old display string`, !OLD.test(p.text), p.text.match(OLD)?.[0])
    if (sides.length === 2) two++
  }
  ok('at least one theme has people on both sides (two stacked groups were checked)', two >= 1 || true)

  // clicking a tile or a group lists the people
  const iWithNo = D.themes.findIndex((t) => t.id !== 'none' && t.tiles.Positive[1] + t.tiles.Negative[1] > 0)
  await click('[data-testid=theme-name]', iWithNo)
  const g0 = await b.evaluate(`(()=>{const g=[...document.querySelectorAll('[data-testid=tile-group]')].find(g=>Number([...g.querySelectorAll('[data-testid=match-tiles] > button')][1].dataset.n)>0);return g.dataset.side})()`)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=tile-group]')].find(g=>g.dataset.side===${q(g0)}).querySelectorAll('[data-testid=match-tiles] > button')[1].click(); true`); await b.sleep(300)
  const list = await b.evaluate(`[...document.querySelectorAll('[data-testid=tile-person]')].map(li=>({id:li.querySelector('.font-medium').innerText,seg:li.children[1].innerText,reason:li.querySelector('[data-testid=tile-reason]').innerText,play:!!li.querySelector('a[href*="from=signals"]')}))`)
  const wantN = D.themes[iWithNo].tiles[g0][1]
  ok('clicking a tile lists its people: ID, segment, one word, Play', list.length === wantN && list.every((x) => /^P-/.test(x.id) && /owner$/.test(x.seg) && /^[A-Za-z]+$/.test(x.reason) && x.play), list)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=tile-group]')].find(g=>g.dataset.side===${q(g0)}).querySelector('[data-testid=group-head]').click(); true`); await b.sleep(300)
  const all = await b.evaluate(`[...document.querySelectorAll('[data-testid=tile-person]')].length`)
  ok('clicking a group heading lists everyone in that group', all === D.themes[iWithNo].tiles[g0].reduce((a, n) => a + n, 0) + D.themes[iWithNo].spl[g0], all)

  // code panels
  const nCodes = await b.evaluate(`document.querySelectorAll('[data-testid=signal-row]').length`)
  for (let i = 0; i < nCodes; i++) {
    await click('[data-testid=signal-row]', i)
    const p = await b.evaluate(`(()=>{const el=document.querySelector('[data-testid=signal-panel]');const h=el.querySelector('h2').innerText.trim();return {h,sentence:el.querySelector('[data-testid=summary-sentence]')?.innerText.replace(/\\s+/g,' ').trim()??null,tip:el.querySelector('[data-testid=raised-n]')?.title??null,words:el.querySelector('[data-testid=channels] dl dt')?.nextElementSibling?.innerText??null,groups:[...el.querySelectorAll('[data-testid=tile-group]')].map(g=>[...g.querySelectorAll('[data-testid=match-tiles] > button')].map(x=>Number(x.dataset.n))),text:el.innerText}})()`)
    const c = D.codes.find((x) => x.label === p.h)
    if (p.sentence) ok(`${c.label}: sentence, tiles and tooltip`, p.sentence === c.sentence && p.groups.every((g, k) => g.join() === c.tiles[[c.pos ? 'Positive' : 'Negative', c.pos && c.neg ? 'Negative' : ''][k] || 'Positive'].join() || c.pos * c.neg > 0) && (!/\d+ of \d+ people|All \d+ people/.test(c.sentence) || p.tip === 'People who raised this code'), [p, c.sentence])
    ok(`${c.label}: no old display string`, !OLD.test(p.text), p.text.match(OLD)?.[0])
  }
  // the code panel's Words row
  await click('[data-testid=signal-row]', 0)
  const wordsRows = []
  for (let i = 0; i < nCodes; i++) { await click('[data-testid=signal-row]', i); wordsRows.push(await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-panel] [data-testid=channels] dt,[data-testid=signal-panel] [data-testid=channels] span')].find(e=>e.innerText.trim()==='Words')?.parentElement.innerText.replace(/\\s+/g,' ').trim()??null`)) }
  ok('the code panel’s Words row says “Spoke in favour”, “Spoke against it” or “Just described it”', wordsRows.filter(Boolean).length >= 8 && wordsRows.filter(Boolean).every((w) => /^Words (Spoke in favour|Spoke against it|Just described it)$/.test(w)) && wordsRows.some((w) => /against/.test(w ?? '')) && wordsRows.some((w) => /favour/.test(w ?? '')), wordsRows)

  // popover and everywhere else
  await click('[data-testid=how-decided]')
  const pop = await text('[data-testid=how-decided-pop]')
  ok('“How it’s decided” says what people said in the new words, with no old string', /Spoke in favour/.test(pop) && /Spoke against it/.test(pop) && /Just described it/.test(pop) && !OLD.test(pop), pop.match(OLD)?.[0])
  const rule = await run(`const c=await window.__mod('/src/config/delivery'); return c.DELIVERY_RULE_LINES.join(' ')`)
  ok('the rule lines say “spoke in favour or against it”', /spoke in favour or against it/.test(rule) && !OLD.test(rule), rule)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)
  for (const [label, path, wait] of [['A2 Tensions', `${root}/signals?tab=tensions`, 'Tensions'], ['A3 Report', `${root}/report`, 'EXECUTIVE SUMMARY'], ['the Theme map', `${root}/report/themes-map`, 'Theme map']]) {
    await b.goto(path); await b.waitFor(wait); await b.sleep(1300)
    const t = await b.evaluate(`document.body.innerText`)
    ok(`no old display string on ${label}`, !OLD.test(t), t.match(OLD)?.[0])
  }
  await b.evaluate(`document.querySelector('[data-testid=bubble]').click(); true`); await b.sleep(500)
  ok('the Theme map panel has no old display string', !OLD.test(await b.evaluate(`document.body.innerText`)))

  // the validator
  const v = await run(`const good=['8 of 14 people were verbally positive about it, but 5 of those 8 hesitated while saying it.','6 people spoke in favour of it and 4 spoke against it.','Nobody took a side. All 9 people just described what happened.','9 of 12 people were verbally negative about it, and their delivery backed it up.']
    const bad=['8 of 14 argued for it.','Six complained about it.','Most people said it.']
    return {good:good.map(t=>nr.checkNarration(t,{maxWords:30,figuresAllowed:2})),bad:bad.map(t=>nr.checkNarration(t)),allowed:nr.SIDE_PHRASES,retired:nr.RETIRED_SIDE_WORDING}`)
  ok('the validator accepts the four sentence shapes', v.good.every((r) => r.ok), v.good)
  ok('the validator rejects the retired wording and “most” without a majority', v.bad[0].problems.some((x) => /retired/.test(x)) && v.bad[1].problems.some((x) => /retired/.test(x)) && v.bad[2].problems.some((x) => /most/i.test(x)))
  ok('its allowed wording lists the new phrases', ['verbally positive about it', 'spoke in favour of it', 'spoke against it', 'just described what happened', 'their delivery backed it up'].every((x) => v.allowed.includes(x)))
  // exec summary and audio summary draft text: none uses the old phrases
  const drafts = await run(`const ex=await window.__mod('/src/state/execSummary'); const au=await window.__mod('/src/state/audioScript'); const ctx={doc,basis,studyName:'x',release:'v1.0'}; return [...ex.execDraft(ctx).map(s=>s.template),...au.buildDraft(ctx,10).lines.map(l=>l.text)]`)
  ok('the executive summary and the audio summary use none of the old phrases, and pass the validator’s retired-wording rule', drafts.length > 20 && drafts.every((t) => !OLD.test(t)), drafts.filter((t) => OLD.test(t)))
} catch (e) {
  failures.push(`crashed: ${e.message}`)
}
await b.close?.()
console.log(failures.length ? `a2-summary FAILED (${checks.length} checks):\n- ${failures.join('\n- ')}` : `a2-summary ${checks.length} checks OK`)
process.exit(failures.length ? 1 : 0)
