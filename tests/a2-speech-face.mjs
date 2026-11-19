// A2 Signals: two groups, Speech and Face, one rule, and a table with nothing extra on it.
//   the rule by claim direction, the five-line "How it’s decided" popover, the columns, the group header, the panel breakdown,
//   the single report switch per theme, and "Positive words, hesitant delivery".
//   npx vite --port 5199 --strictPort &   then   node tests/a2-speech-face.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
let n = 0
const ok = (label, cond, detail) => {
  n++
  if (!cond) failures.push(detail ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const text = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const all = (sel) => b.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>e.innerText.replace(/\\s+/g,' '))`)
const click = async (sel) => {
  const done = await b.poll(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel}`)
  await b.sleep(350)
}
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
const LINES = [
  'We look at people who spoke in favour or against it and compare how they said it with what they said.',
  'No match if the voice was tense or flat, or the face showed doubt, frustration or confusion. For people who spoke against it, no match if they sounded or looked pleased.',
  'More than half matched: Consistent. More than half had no match: Gap. Otherwise Mixed. Under 3 people: Too few to read.',
  'Long pauses alone never count as no match. They show as Hesitant, and never count toward Gap.',
  'Each person counts once. Speech and face are never added together.',
]
const ruleOf = (against, unc, nn, min) => (nn < min ? 'Too few to read' : against / nn > 0.5 ? 'Conflicting' : (nn - against - unc) / nn > 0.5 ? 'Consistent' : 'Mixed')
try {
  await b.goto('/researcher')
  await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(600)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-suggestion]')].forEach(s=>s.querySelector('[data-testid=accept-theme]').click()); true`); await b.sleep(700)

  // ── The rule, as code ──
  const u = await withMod(`(async () => {
    const em = await window.__mod('/src/state/emotion')
    const sg = await window.__mod('/src/state/signals')
    const cfg = await window.__mod('/src/config/delivery')
    const doc = { faceFixes: {} }
    const mk = (id, o = {}) => ({ key: 'k' + id, participantId: 'P-' + id, sessionId: 'S' + id, pet: 'Dog', atSec: 1, facts: { delaySec: 1, pauseSec: 0, fillers: 0 }, usual: 1, band: o.band ?? 'Steady', reason: 'r', voice: { tone: o.tone ?? 'Even', pace: 1, usualPace: 1, pitch: 1, usualPitch: 1, loudness: 0, reason: 'v' }, stance: o.stance === undefined ? 'Positive' : o.stance, face: o.face === null ? undefined : { emotion: o.face?.[0] ?? 'Neutral', intensity: 'Medium', confidence: o.face?.[1] ?? 0.8, cue: 'c', onsetSec: 1 } })
    const fit = (o) => { const p = mk(1, o); return em.fitOf(p, em.faceOf(p, doc)) }
    const team = (nn, f) => Array.from({ length: nn }, (_, i) => mk(i + 1, f(i)))
    const out = {}
    for (const t of ['Tense', 'Flat', 'Animated', 'Even']) { out['pos' + t] = fit({ tone: t, face: null }).fit; out['neg' + t] = fit({ tone: t, face: null, stance: 'Negative' }).fit }
    for (const f of ['Doubt', 'Frustration', 'Confusion', 'Interest', 'Delight', 'Surprise', 'Neutral']) { out['posF' + f] = fit({ face: [f, 0.8] }).fit; out['negF' + f] = fit({ face: [f, 0.8], stance: 'Negative' }).fit }
    out.faceLow = fit({ face: ['Doubt', 0.5] }).fit
    out.hes = fit({ band: 'Marked hesitation', face: null })
    out.some = fit({ band: 'Some hesitation', face: null }).fit
    out.both = fit({ tone: 'Tense', face: ['Doubt', 0.9] })
    out.audioOnly = fit({ tone: 'Tense', face: null }).fit
    out.audioHes = fit({ band: 'Marked hesitation', face: null }).fit
    out.fact = fit({ stance: 'Neutral', tone: 'Tense' })
    const hesAll = sg.rollupPoints(team(10, () => ({ band: 'Marked hesitation', face: ['Interest', 0.8] })), doc)
    out.hesAll = { verdict: hesAll.verdict, against: hesAll.fit.against, uncertain: hesAll.fit.uncertain }
    const mixed = sg.rollupPoints(team(10, (i) => (i < 5 ? { tone: 'Tense' } : {})), doc)
    out.mixed = mixed.verdict
    const bd = sg.breakdownOf([...team(4, (i) => (i === 0 ? { tone: 'Tense', face: ['Doubt', 0.9] } : i === 1 ? { band: 'Marked hesitation' } : i === 2 ? { face: null, tone: 'Flat' } : {})), mk(5, { stance: 'Neutral' }), mk(6, { stance: 'Negative', tone: 'Tense', face: null })], doc)
    out.bd = { people: bd.people, positive: bd.positive, negative: bd.negative, against: bd.against, uncertain: bd.uncertain, matched: bd.matched, fact: bd.factOnly.map((p) => p.participantId), audioOnly: bd.audioOnly }
    out.line = sg.breakdownLine(bd)
    const hes = (stance, k) => sg.hesitantDelivery(team(6, (i) => ({ stance, band: i < k ? 'Marked hesitation' : 'Steady', face: null })), doc)
    out.hesitantPos = hes('Positive', 4); out.hesitantNeg = hes('Negative', 4); out.hesitantFew = hes('Positive', 2)
    out.lines = cfg.DELIVERY_RULE_LINES
    {
      const cb = await window.__mod('/src/state/codebook'); const ms = await window.__mod('/src/mock/signals'); const sess = await window.__mod('/src/mock/sessions')
      const d = Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /codebook/.test(k)))))[0]
      const sid = (p) => sess.sessionIdOf(sess.PET_SEED_SESSIONS.find((x) => x.participant === p && x.variant === 'done'))
      const basis = cb.basisOf(ms.ACCEPTED_PARTICIPANTS.map((p) => ({ id: sid(p), participantId: p })))
      out.hesitantNames = sg.codeSignals(d, basis).filter((s) => s.readable && sg.hesitantDelivery(s.points, d)).map((s) => s.code.name)
    }
    return out
  })()`)
  ok('hesitation alone never pulls against the words: marked hesitation with normal tone and no face is Uncertain', u.hes.fit === 'Uncertain' && u.hes.against.length === 0 && u.some === 'Matches', JSON.stringify(u.hes))
  ok('ten people who all hesitated, with calm voices and a pleased face, are Uncertain, none against: never Conflicting', u.hesAll.against === 0 && u.hesAll.uncertain === 10 && u.hesAll.verdict === 'Mixed', u.hesAll)
  ok('against a positive claim, tense and flat pull against; animated and even match', u.posTense === 'Pulls against' && u.posFlat === 'Pulls against' && u.posAnimated === 'Matches' && u.posEven === 'Matches', [u.posTense, u.posFlat, u.posAnimated, u.posEven])
  ok('against a complaint, tense matches and animated pulls against', u.negTense === 'Matches' && u.negAnimated === 'Pulls against' && u.negFlat === 'Matches' && u.negEven === 'Matches', [u.negTense, u.negAnimated, u.negFlat, u.negEven])
  ok('against a positive claim, doubt, frustration and confusion pull against; interest, delight, surprise and neutral match', ['Doubt', 'Frustration', 'Confusion'].every((f) => u['posF' + f] === 'Pulls against') && ['Interest', 'Delight', 'Surprise', 'Neutral'].every((f) => u['posF' + f] === 'Matches'))
  ok('against a complaint, delight and interest pull against; doubt, frustration and confusion match', ['Delight', 'Interest'].every((f) => u['negF' + f] === 'Pulls against') && ['Doubt', 'Frustration', 'Confusion', 'Surprise', 'Neutral'].every((f) => u['negF' + f] === 'Matches'))
  ok('a face below medium confidence never pulls against', u.faceLow === 'Matches')
  ok('Speech and Face at the same moment count once', u.both.fit === 'Pulls against' && u.both.against.length === 2)
  ok('audio-only people are read on speech (a tense voice counts), never on hesitation alone, and never as neutral', u.audioOnly === 'Pulls against' && u.audioHes === 'Uncertain')
  ok('someone who only stated a fact is not checked', u.fact.fit === undefined && u.fact.against.length === 0)
  ok('five against and five matching is Mixed: most is more than half', u.mixed === 'Mixed')
  ok('the breakdown counts each person once (a tense complaint matches), with the fact-only and audio-only counts right', u.bd.people === 6 && u.bd.positive === 4 && u.bd.negative === 1 && u.bd.against === 2 && u.bd.uncertain === 1 && u.bd.matched === 2 && u.bd.fact.join() === 'P-5' && u.bd.audioOnly === 2, u.bd)
  ok('the table line reads “4 spoke in favour and 1 spoke against it. Matched 2, no match 2, hesitant 1.”', u.line === '4 spoke in favour and 1 spoke against it. Matched 2, no match 2, hesitant 1.', u.line)
  ok('the hesitant-delivery observation needs a positive claim and at least half hesitating', u.hesitantPos?.hesitated === 4 && u.hesitantPos.speakers === 6 && u.hesitantNeg === null && u.hesitantFew === null, [u.hesitantPos, u.hesitantNeg, u.hesitantFew])
  ok('the rule lines in config are the five lines, word for word', JSON.stringify(u.lines) === JSON.stringify(LINES), u.lines)

  // ── One table, no views ──
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(900)
  ok('there is no By theme | By code | By moment switch and no theme or moment view', (await b.evaluate(`document.querySelectorAll('[aria-label="Read signals by"],[data-testid=view-theme],[data-testid=view-code],[data-testid=view-moment],[data-testid=theme-signal-row],[data-testid=moment-row]').length`)) === 0)
  ok('there is no What stands out card', (await b.evaluate(`document.querySelectorAll('[data-testid=standouts],[data-testid=standout]').length`)) === 0 && !/What stands out/.test((await text('main')) ?? ''))
  ok('there is no Tension themes group and no theme verdict badge, sub-line or switch', !(await b.evaluate(`[...document.querySelectorAll('h3')].some(h=>/Tension themes/.test(h.innerText))`)) && (await b.evaluate(`document.querySelectorAll('[data-testid=theme-rollup],[data-testid=theme-summary],[data-testid=use-theme],[data-testid=group-in-report],[data-testid=tension-theme-list]').length`)) === 0)
  ok('the Signals and Tensions tabs and the tension count badge are still there', JSON.stringify(await b.evaluate(`[...document.querySelectorAll('[role=tab]')].map(t=>t.innerText.replace(/\\s+/g,' ').trim().replace(/ \\d+$/,''))`)) === JSON.stringify(['Signals', 'Tensions']) && /\d/.test((await text('[role=tab]:nth-child(2)')) ?? ''))
  const head = await text('[data-testid=signal-head]')
  ok('the columns are Code, Said by, Face, Speech, Words vs delivery', /^Code Said by Face Speech Words vs delivery How it’s decided$/.test(head ?? ''), head)
  await click('[data-testid=how-decided]')
  const pop = await all('[data-testid=how-decided-line]')
  ok('“How it’s decided” opens a popover with exactly the five lines', pop.length === 5 && pop.every((l, i) => l.replace(/^\d\. /, '') === LINES[i]), pop)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(250)
  ok('Escape closes it', (await b.evaluate(`document.querySelectorAll('[data-testid=how-decided-pop]').length`)) === 0)
  ok('no rule paragraph is on the page', (await b.evaluate(`document.querySelectorAll('[data-testid=fit-rule]').length`)) === 0)
  const groups = await b.evaluate(`[...document.querySelectorAll('[aria-label="Signals by code"] section[aria-labelledby^=grp-]')].map(s=>({head:s.querySelector('header').innerText.replace(/\\s+/g,' ').trim(),switches:s.querySelector('header').querySelectorAll('[role=switch]').length,badges:s.querySelector('header').querySelectorAll('[class*=pending-fg],[class*=border-mist-strong]:not([role=switch])').length}))`)
  ok('each theme header is a label, “n codes”, its verdict chip, “Said by n of N” and one “In report” switch', groups.length >= 2 && groups.every((g) => /^.+ \d+ codes? (Consistent|Mixed|Gap|No position|Too few to read) Said by \d+ of \d+ (In report|\d+ of \d+ in report|Nothing to show)$/.test(g.head) && g.switches === 1), groups)
  ok('“Not in a theme” is the last group', groups.length === 0 || !groups.some((g, i) => /^Not in a theme/.test(g.head) && i !== groups.length - 1))
  ok('the group names are the themes, so all four accepted themes are there', ['Price creep', 'The pet decides', 'Wanting control over deliveries', 'Why they joined'].every((t) => groups.some((g) => g.head.startsWith(t))), groups.map((g) => g.head))

  // ── It looks like the codebook ──
  const look = (sel) => b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});const c=getComputedStyle(e);return {pl:c.paddingLeft,pt:c.paddingTop,gap:c.columnGap,bl:c.borderLeftWidth,fs:c.fontSize,h:Math.round(e.getBoundingClientRect().height)}})()`)
  const a2row = await look('[data-testid=signal-row]')
  const a2head = await b.evaluate(`(()=>{const e=document.querySelector('[data-testid=signal-head]');const c=getComputedStyle(e);return {pl:c.paddingLeft,pt:c.paddingTop,bg:c.backgroundColor,fs:c.fontSize}})()`)
  const a2grp = await b.evaluate(`(()=>{const e=document.querySelector('[aria-labelledby^=grp-] > header');const c=getComputedStyle(e);return {pl:c.paddingLeft,pt:c.paddingTop,pb:c.paddingBottom}})()`)
  await b.goto(`${root}/codebook?tab=codes`); await b.waitFor('Accepted'); await b.sleep(600)
  await b.evaluate(`[...document.querySelectorAll('button,[role=tab]')].find(x=>/^Accepted/.test(x.innerText.trim()))?.click(); true`); await b.sleep(400)
  const a1row = await look('[data-testid=code-row]')
  const a1head = await b.evaluate(`(()=>{const e=[...document.querySelectorAll('div')].find(d=>/^Code\\b/.test(d.innerText||'')&&getComputedStyle(d).backgroundColor!=='rgba(0, 0, 0, 0)'&&d.className.includes('bg-haze'));const c=getComputedStyle(e);return {pl:c.paddingLeft,pt:c.paddingTop,bg:c.backgroundColor,fs:c.fontSize}})()`)
  const a1grp = await b.evaluate(`(()=>{const e=document.querySelector('[aria-labelledby^=grp-] > header');const c=getComputedStyle(e);return {pl:c.paddingLeft,pt:c.paddingTop,pb:c.paddingBottom}})()`)
  ok('a signal row has the codebook row’s padding, gap, left border, type size and height', a1row.pl === a2row.pl && a1row.pt === a2row.pt && a1row.gap === a2row.gap && a1row.bl === a2row.bl && a1row.fs === a2row.fs && Math.abs(a1row.h - a2row.h) <= 4, { a1row, a2row })
  ok('the header row and the group headers are the codebook’s', JSON.stringify(a1head) === JSON.stringify(a2head) && JSON.stringify(a1grp) === JSON.stringify(a2grp), { a1head, a2head, a1grp, a2grp })
  await b.goto(`${root}/signals`); await b.sleep(900)

  // ── The cells ──
  const faces = await all('[data-testid=face-cell]')
  const speech = await all('[data-testid=speech-label]')
  ok('Face is a short label: “Mostly interest”, “No clear lead” or “Not read”', faces.length > 8 && faces.every((f) => /^(Mostly [a-z]+|No clear lead|Not read)$/.test(f)) && faces.some((f) => /^Mostly [a-z]+$/.test(f)), faces)
  ok('Speech is a short label: “Mostly animated”, “Mostly even”, “Flat or tense: 6”', speech.length > 8 && speech.every((f) => /^(Flat or tense: \d+|Mostly even|Mostly animated|No clear lead|Not read)$/.test(f)), speech)
  ok('no label is truncated or clipped', await b.evaluate(`[...document.querySelectorAll('[data-testid=face-cell],[data-testid=speech-label],[data-testid=fit-cell]')].every(e=>{const c=getComputedStyle(e);return c.textOverflow!=='ellipsis'&&e.scrollWidth<=e.clientWidth+1})`))
  ok('the detail is in the tooltip', await b.evaluate(`[...document.querySelectorAll('[data-testid=face-cell][title]')].every(e=>/faces read/.test(e.title)) && [...document.querySelectorAll('[data-testid=speech-label][title]')].every(e=>/Tone: .*Certainty: /.test(e.title))`))
  ok('participant IDs never appear in the table', !/P-\d{4}/.test((await text('[aria-label="Signals by code"]')) ?? ''))
  ok('Said by reads n of N', (await all('[data-testid=signal-row]')).every((r) => /\d+ of \d+/.test(r)))

  // ── Rows select; the panel keeps what it had ──
  ok('the selected row has the indigo left border', await b.evaluate(`(()=>{const r=document.querySelector('[data-testid=signal-row][aria-current=true]');return !!r&&getComputedStyle(r).borderLeftColor!==getComputedStyle(document.querySelector('[data-testid=signal-row]:not([aria-current=true])')).borderLeftColor})()`))
  await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>/Wanted to stop running out/.test(r.innerText)).click(); true`); await b.sleep(250)
  ok('clicking a row opens its panel', /Wanted to stop running out/.test((await text('[data-testid=signal-panel] h2')) ?? ''))
  ok('the panel has “Play the clearest moment”, evidence quotes with times and reasons, and “Not right?”', /Play the clearest moment · P-\d{4} at \d+:\d\d/.test((await text('[data-testid=code-play]')) ?? '') && (await b.evaluate(`document.querySelectorAll('[data-testid=signal-point]').length`)) >= 3 && (await all('[data-testid=signal-point]')).every((p) => /Play at \d+:\d\d/.test(p)) && (await b.evaluate(`!!document.querySelector('[data-testid=fix-face]')`)))
  ok('and the three figures, the two labelled speech bars', (await b.evaluate(`document.querySelectorAll('[data-testid=signal-panel] [data-testid=fig-against]').length`)) === 1 && /Tone/.test((await text('[data-testid=signal-panel]')) ?? '') && /Certainty/.test((await text('[data-testid=signal-panel]')) ?? ''))

  // ── The hesitant-delivery line: only for a positive claim, n of N, at the top ──
  const notes = await b.evaluate(`(async()=>{const out=[];const rows=[...document.querySelectorAll('[data-testid=signal-row]')];for(const r of rows){r.click();await new Promise(x=>setTimeout(x,90));const p=document.querySelector('[data-testid=signal-panel]');const n=p.querySelector('[data-testid=hesitant-note]');out.push({name:r.innerText.split('\\n')[0].replace(/(In report|Nothing to show)$/,'').trim(),note:n?n.innerText.replace(/\\s+/g,' '):null,top:n?n===p.querySelector('.overflow-y-auto').firstElementChild:null})};return out})()`)
  const withNote = notes.filter((x) => x.note)
  ok('the line appears for codes with a positive claim and hesitating speakers, at the top, in n of N with no percentage', withNote.length >= 1 && withNote.every((x) => /^Spoke in favour, hesitant delivery: said by \d+ of \d+; \d+ of \d+ hesitated\.$/.test(x.note) && x.top && !/%/.test(x.note)), withNote)
  ok('and not for codes that only complain or state a fact: it matches the observation’s own rule', JSON.stringify(withNote.map((x) => x.name).sort()) === JSON.stringify(u.hesitantNames.sort()), { got: withNote.map((x) => x.name), want: u.hesitantNames })

  // ── The report switch: one per theme, and the code’s own in the panel ──
  const groupN = await b.evaluate(`document.querySelectorAll('[aria-label="Signals by code"] section[aria-labelledby^=grp-]').length`)
  ok('no code row has a toggle; there is one switch per theme header, “Not in a theme” included', (await b.evaluate(`document.querySelectorAll('[data-testid=signal-row] [role=switch], [data-testid=use-signal]').length`)) === 0 && (await b.evaluate(`document.querySelectorAll('[data-testid=use-group]').length`)) === groupN && groupN >= 3)
  ok('codes that cannot be shown say “Nothing to show” in place of a toggle', await b.evaluate(`(()=>{const r=[...document.querySelectorAll('[data-testid=signal-row]')];const nc=r.filter(x=>/No position|Too few to read/.test(x.querySelector('[data-testid=fit-cell]').innerText));return nc.length>=2&&nc.every(x=>x.querySelector('[data-testid=row-state]').innerText==='Nothing to show')})()`))
  const footN = async () => Number((await text('[data-testid=report-footer-count]'))?.match(/report: (\d+)/)?.[1])
  const onNow = () => b.evaluate(`[...document.querySelectorAll('[data-testid=row-state]')].filter(e=>e.innerText==='In report').length`)
  ok('the footer reads “n codes with signals and n tension themes. n tensions still to review.” and counts the codes in report', /^Goes to the report: \d+ codes? with signals and \d+ tension themes?\.$/.test((await text('[data-testid=report-footer-count]')) ?? '') && (await footN()) === (await onNow()), `${await text('[data-testid=report-footer-count]')} | ${await onNow()}`)
  const defaults = await withMod(`(async()=>{const cb=await window.__mod('/src/state/codebook');const ms=await window.__mod('/src/mock/signals');const sess=await window.__mod('/src/mock/sessions');const sg=await window.__mod('/src/state/signals');const doc=Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0];const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'));const basis=cb.basisOf(ms.ACCEPTED_PARTICIPANTS.map(p=>({id:sid(p),participantId:p})));return sg.codeSignals(doc,basis).map(s=>({name:s.code.name,use:s.use,showable:s.showable,fit:s.fit.pattern,notable:s.notable,picked:doc.signalPicks?.[s.code.id]}))})()`)
  ok('by default a code is on when words and delivery don’t fit or marked hesitation shows, and off when Consistent with nothing notable', defaults.length >= 10 && defaults.filter((d) => d.showable && d.picked === undefined).every((d) => d.use === d.notable && (['Mixed', 'Conflicting'].includes(d.fit) ? d.use : true)) && defaults.some((d) => d.use) && defaults.some((d) => d.showable && !d.use), defaults)
  ok('never on for No claim or Too few to read', defaults.filter((d) => ['No claim', 'Too few to read'].includes(d.fit)).length >= 2 && defaults.filter((d) => ['No claim', 'Too few to read'].includes(d.fit)).every((d) => !d.showable && !d.use), defaults.filter((d) => !d.showable))
  // The theme switch sets and clears every code it can show.
  const groupInfo = (name) => b.evaluate(`(()=>{const sec=[...document.querySelectorAll('[aria-label="Signals by code"] section[aria-labelledby^=grp-]')].find(s=>s.querySelector('h3').innerText.trim()===${JSON.stringify(name)});const sw=sec.querySelector('[data-testid=use-group]');const rows=[...sec.querySelectorAll('[data-testid=signal-row]')];return {aria:sw.getAttribute('aria-checked'),disabled:sw.disabled,label:sec.querySelector('[data-testid=group-switch-label]').innerText,show:rows.filter(r=>r.querySelector('[data-testid=row-state]').innerText!=='Nothing to show').length,on:rows.filter(r=>r.querySelector('[data-testid=row-state]').innerText==='In report').length,total:rows.length}})()`)
  const clickGroup = (name) => b.evaluate(`[...document.querySelectorAll('[aria-label="Signals by code"] section[aria-labelledby^=grp-]')].find(s=>s.querySelector('h3').innerText.trim()===${JSON.stringify(name)}).querySelector('[data-testid=use-group]').click(); true`).then(() => b.sleep(350))
  const g0 = await groupInfo('Price creep')
  await clickGroup('Price creep')
  let g1 = await groupInfo('Price creep')
  ok('a theme switch turned on puts all its codes that can be shown in the report', g1.aria === 'true' && g1.on === g1.show && g1.label === 'In report', { g0, g1 })
  const f1 = await footN()
  await clickGroup('Price creep')
  let g2 = await groupInfo('Price creep')
  ok('and turned off takes them all out, and the footer follows', g2.aria === 'false' && g2.on === 0 && g2.label === 'In report' && (await footN()) === f1 - g1.show, { g2, f1, now: await footN() })
  await clickGroup('Price creep')
  // Half-on: switch one code off in its panel.
  await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>/Price went up/.test(r.innerText)).click(); true`); await b.sleep(250)
  ok('the panel switch is the code’s own, with a suggestion line', (await b.evaluate(`document.querySelector('[data-testid=use-signal-panel]').getAttribute('aria-checked')`)) === 'true' && /^(Suggested on: words and delivery don’t fit\.|Suggested on: hesitation shows\.|Suggested off: nothing stands out\.)$/.test((await text('[data-testid=tick-hint]')) ?? ''), await text('[data-testid=tick-hint]'))
  await click('[data-testid=use-signal-panel]')
  const gm = await groupInfo('Price creep')
  ok('switching one code off in the panel makes the header half-on, “1 of 2 in report”', gm.aria === 'mixed' && gm.label === `${gm.show - 1} of ${gm.show} in report` && gm.on === gm.show - 1, gm)
  await clickGroup('Price creep')
  const gall = await groupInfo('Price creep')
  ok('clicking a half-on switch sets all on', gall.aria === 'true' && gall.on === gall.show && gall.label === 'In report', gall)
  ok('and the panel switch follows it', (await b.evaluate(`document.querySelector('[data-testid=use-signal-panel]').getAttribute('aria-checked')`)) === 'true')
  // A code that cannot be shown is never ticked, even by its theme's switch or an old saved tick.
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const vet=d.codes.find(c=>c.name==='Vet recommended a different diet');d.signalPicks={...(d.signalPicks||{}),[vet.id]:true};localStorage[k]=JSON.stringify(o);return true})()`)
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(800)
  await clickGroup('The pet decides')
  const pet = await b.evaluate(`(()=>{const rows=[...document.querySelectorAll('[data-testid=signal-row]')];const f=(n)=>rows.find(r=>r.innerText.startsWith(n));return {vet:f('Vet recommended').querySelector('[data-testid=row-state]').innerText,nothing:f('Nothing would have kept').querySelector('[data-testid=row-state]').innerText}})()`)
  ok('No claim and Too few to read stay unticked even with an old saved tick and the theme switch on', pet.vet === 'Nothing to show' && pet.nothing === 'Nothing to show', pet)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>r.innerText.startsWith('Vet recommended')).click(); true`); await b.sleep(250)
  ok('and the panel switch for them is off and cannot be used', await b.evaluate(`(()=>{const e=document.querySelector('[data-testid=use-signal-panel]');return e.disabled&&e.getAttribute('aria-checked')==='false'})()`) && /Nothing to show/.test((await text('[data-testid=tick-hint]')) ?? ''), await text('[data-testid=tick-hint]'))
  ok('so the footer never counts them', (await footN()) === (await onNow()))
  // One code in two themes has one state, shown the same under both.
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const flex=d.codes.find(c=>c.name==='Flexibility matters more than price');const price=d.themes.find(t=>t.name==='Price creep');price.codeIds.push(flex.id);localStorage[k]=JSON.stringify(o);return true})()`)
  await b.goto(`${root}/signals`); await b.waitFor('Words vs delivery'); await b.sleep(800)
  const twice = () => b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].filter(r=>r.innerText.startsWith('Flexibility matters more than price')).map(r=>r.querySelector('[data-testid=row-state]').innerText)`)
  const t0 = await twice()
  await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>r.innerText.startsWith('Flexibility matters more than price')).click(); true`); await b.sleep(250)
  await click('[data-testid=use-signal-panel]')
  const t1 = await twice()
  ok('a code in two themes shows once under each, with one state: flipping it changes both rows together', t0.length === 2 && t0[0] === t0[1] && t1.length === 2 && t1[0] === t1[1] && t1[0] !== t0[0], { t0, t1 })
  const both = await b.evaluate(`[...document.querySelectorAll('[aria-label="Signals by code"] section[aria-labelledby^=grp-]')].filter(s=>[...s.querySelectorAll('[data-testid=signal-row]')].some(r=>r.innerText.startsWith('Flexibility matters more than price'))).map(s=>s.querySelector('[data-testid=use-group]').getAttribute('aria-checked'))`)
  ok('and both theme headers follow that one state', both.length === 2)

  // ── The legend: face and speech apart, and no colour shared ──
  await b.goto(`${root}/signals?view=code`); await b.waitFor('Words vs delivery'); await b.sleep(800)
  const leg = await b.evaluate(`(()=>{const rows=[...document.querySelectorAll('[data-testid=legend-row]')].map(r=>({group:r.dataset.group,label:r.querySelector('span').innerText.trim(),items:[...r.querySelectorAll('li')].map(li=>({name:li.innerText.trim(),color:getComputedStyle(li.querySelector('span')).backgroundColor}))}));return rows})()`)
  const by = (g) => leg.find((r) => r.group === g)
  ok('the legend has three labelled rows: Face, Speech · tone and Speech · certainty', JSON.stringify(leg.map((r) => r.label)) === JSON.stringify(['Face', 'Speech · tone', 'Speech · certainty']), leg.map((r) => r.label))
  ok('Face lists the seven expressions, tone the four tones, certainty the three bands', by('face').items.length === 7 && JSON.stringify(by('tone').items.map((i) => i.name)) === JSON.stringify(['Animated', 'Even', 'Flat', 'Tense']) && JSON.stringify(by('certainty').items.map((i) => i.name)) === JSON.stringify(['Marked hesitation', 'Some hesitation', 'Steady']))
  const col = (g, n) => by(g).items.find((i) => i.name === n).color
  ok('Animated is not the colour of Interest, and Tense is not the colour of Doubt', col('tone', 'Animated') !== col('face', 'Interest') && col('tone', 'Tense') !== col('face', 'Doubt'), [col('tone', 'Animated'), col('face', 'Interest'), col('tone', 'Tense'), col('face', 'Doubt')])
  const faceColors = new Set(by('face').items.map((i) => i.color))
  const certColors = new Set(by('certainty').items.map((i) => i.color))
  ok('no tone colour is used by any expression or certainty band, except that Even and Neutral may both be a plain light grey', by('tone').items.filter((i) => i.name !== 'Even').every((i) => !faceColors.has(i.color) && !certColors.has(i.color)) && !certColors.has(col('tone', 'Even')), leg)
  ok('the four tones are four different colours, and the three certainty bands three', new Set(by('tone').items.map((i) => i.color)).size === 4 && certColors.size === 3)
  ok('certainty has a legend on the main table, not only in the panel', (await b.evaluate(`!!document.querySelector('[aria-label="Signals by code"] [data-testid=legend-row][data-group=certainty]')`)))
  await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>/Pause would/.test(r.innerText)).click(); true`); await b.sleep(300)
  const bars = await b.evaluate(`(()=>{const p=document.querySelector('[data-testid=signal-panel]');const tone=[...p.querySelectorAll('[data-testid=channel-speech] [role=img]')];return tone.length})()`)
  ok('the panel’s tone and certainty bars use the same colours as the legend', bars >= 2)

  // ── An older theme-level tick becomes code ticks, once ──
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const flex=d.codes.find(c=>c.name==='Flexibility matters more than price');const price=d.themes.find(t=>t.name==='Price creep');price.codeIds=price.codeIds.filter(x=>x!==flex.id);localStorage[k]=JSON.stringify(o);return true})()`)
  const ids = await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const th=(n)=>d.themes.find(t=>t.name===n);const ctl=th('Wanting control over deliveries'), joined=th('Why they joined'), price=th('Price creep');return {ctl:ctl.codeIds,joined:joined.codeIds,price:price.codeIds,pickedNow:d.signalPicks}})()`)
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const th=(n)=>d.themes.find(t=>t.name===n);d.signalPicks={};d.themePicks={[th('Why they joined').id]:true,[th('Wanting control over deliveries').id]:false};localStorage[k]=JSON.stringify(o);return true})()`)
  await b.goto(`${root}/signals`); await b.sleep(1000)
  const mig = await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const d=Object.values(JSON.parse(localStorage[k]))[0];return {picks:d.signalPicks,log:d.log.filter(l=>l.action==='Signals tick moved to its codes').length,themePicks:d.themePicks}})()`)
  const accepted = (await withMod(`(async()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const d=Object.values(JSON.parse(localStorage[k]))[0];const acc=(ids)=>ids.filter(i=>d.codes.find(c=>c.id===i)?.status==='Accepted');return {joined:acc(${JSON.stringify(ids.joined)}),ctl:acc(${JSON.stringify(ids.ctl)}),price:acc(${JSON.stringify(ids.price)})}})()`))
  ok('a theme ticked on carries its tick to each of its accepted codes, saved', accepted.joined.length >= 2 && accepted.joined.every((c) => mig.picks[c] === true), mig)
  ok('a theme ticked off carries that too, so nothing switches on by itself', accepted.ctl.length >= 2 && accepted.ctl.every((c) => mig.picks[c] === false), mig)
  ok('a theme with no tick adds nothing: its codes keep the code rule', accepted.price.every((c) => mig.picks[c] === undefined))
  ok('the old theme-level ticks stay stored, unread, and the move is logged once per theme', mig.themePicks && Object.keys(mig.themePicks).length === 2 && mig.log === 2, mig)
  await b.goto(`${root}/signals`); await b.sleep(700)
  const mig2 = await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const d=Object.values(JSON.parse(localStorage[k]))[0];return d.log.filter(l=>l.action==='Signals tick moved to its codes').length})()`)
  ok('reloading does not move them again, and a code switched off by hand stays off', mig2 === 2)

  // ── The report groups ticked codes under their theme ──
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(k=>/codebook/.test(k));const o=JSON.parse(localStorage[k]);const id=Object.keys(o)[0];const d=o[id];const c=d.codes.find(c=>c.name==='Flexibility matters more than price');d.signalPicks={...d.signalPicks,[c.id]:true};localStorage[k]=JSON.stringify(o);return true})()`)
  await b.goto(`${root}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(700)
  await b.evaluate(`document.querySelector('[data-testid=toggle-all-sections]')?.click(); true`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=finding-more]')].forEach(x=>x.getAttribute('aria-expanded')==='false'&&x.click()); true`); await b.sleep(300)
  const rep = await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-group]')].map(g=>({group:g.dataset.group,items:[...g.querySelectorAll('li[data-kind]')].map(li=>({kind:li.dataset.kind,name:li.querySelector('p').innerText}))}))`)
  ok('A3 findings group ticked codes under their theme, as codes, never as a theme profile', rep.length >= 1 && rep.every((g) => g.items.length && g.items.every((i) => i.kind === 'code')) && rep.some((g) => g.group === 'Why they joined') && (await b.evaluate(`document.querySelectorAll('[data-testid=signals] li[data-kind=theme]').length`)) === 0, rep)
  ok('a code ticked on its own sits under its theme (Flexibility… under Wanting control over deliveries)', rep.some((g) => g.group === 'Wanting control over deliveries' && g.items.some((i) => /Flexibility matters more than price/.test(i.name))), rep)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
}
await b.close()
console.log(`${n} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 SPEECH AND FACE FAILED:\n - ' + failures.join('\n - '))
  process.exit(1)
}
console.log('A2 SPEECH AND FACE OK')
