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
  'We look at people who argued for the idea and compare how they said it with what they said.',
  'It didn’t fit if the voice was tense or flat, or the face showed doubt, frustration or confusion. For a complaint, it didn’t fit if they sounded or looked pleased.',
  'Most didn’t fit: Conflicting. Most fit: Consistent. Otherwise Mixed. Under 3 people: too few to read.',
  'Long pauses alone never count as not fitting. They show as Uncertain.',
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
  ok('the table line reads “4 of 6 argued for it and 1 complained. 2 pulled against, 1 uncertain.”', u.line === '4 of 6 argued for it and 1 complained. 2 pulled against, 1 uncertain.', u.line)
  ok('the hesitant-delivery observation needs a positive claim and at least half hesitating', u.hesitantPos?.hesitated === 4 && u.hesitantPos.speakers === 6 && u.hesitantNeg === null && u.hesitantFew === null, [u.hesitantPos, u.hesitantNeg, u.hesitantFew])
  ok('the rule lines in config are the five lines, word for word', JSON.stringify(u.lines) === JSON.stringify(LINES), u.lines)

  // ── The table ──
  await b.goto(`${root}/signals?view=code`); await b.waitFor('What stands out'); await b.sleep(700)
  ok('no rule paragraph is on the page', (await b.evaluate(`document.querySelectorAll('[data-testid=fit-rule]').length`)) === 0 && !/How it’s decided\. /.test((await text('[aria-label="Signals by code"]')) ?? ''))
  const head = await text('[data-testid=signal-head]')
  ok('the columns are Code, Said by, Face, Speech, Words vs delivery, and there is no Report column', /^Code Said by Face Speech Words vs delivery/.test(head ?? '') && !/Report/.test(head ?? ''), head)
  ok('no code has a report tick, and the channel switch is gone from By code', (await b.evaluate(`document.querySelectorAll('[data-testid=use-signal]').length`)) === 0 && (await b.evaluate(`document.querySelectorAll('[data-testid=lens-emotion],[data-testid=lens-speech],[data-testid=lens-voice],[data-testid=lens-hesitation]').length`)) === 0)
  await click('[data-testid=how-decided]')
  const pop = await all('[data-testid=how-decided-line]')
  ok('“How it’s decided” opens a popover with exactly the five lines', pop.length === 5 && pop.every((l, i) => l.replace(/^\d\. /, '') === LINES[i]), pop)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(250)
  ok('Escape closes it', (await b.evaluate(`document.querySelectorAll('[data-testid=how-decided-pop]').length`)) === 0)
  const faces = await all('[data-testid=face-cell]')
  const speech = await all('[data-testid=speech-label]')
  ok('Face is a short label: “4 of 10 interest” or “Mixed reactions”, never “Tied at”', faces.length > 8 && faces.every((f) => /^(\d+ of \d+ [a-z]+|Mixed reactions|No video|No clear reading)$/.test(f)) && faces.some((f) => /^\d+ of \d+ [a-z]+$/.test(f)), faces)
  ok('Speech is a short label: “3 flat or tense”, “Mostly even”', speech.length > 8 && speech.every((f) => /^(\d+ flat or tense|Mostly even|Mostly animated|Mixed tone)$/.test(f)), speech)
  ok('Mixed reactions keeps its detail in a tooltip', await b.evaluate(`[...document.querySelectorAll('[data-testid=face-cell]')].filter(e=>e.innerText==='Mixed reactions').every(e=>/Tied at \\d+ each: /.test(e.title))`))
  const heads = await all('[data-testid=theme-rollup]')
  ok('a theme’s sub-header is one line: “16 people · faces read for 12 · marked hesitation in 6”', heads.length >= 3 && heads.every((h) => /^\d+ (people|person) · faces read for \d+ · marked hesitation in \d+/.test(h)) && !(await b.evaluate(`document.querySelectorAll('[data-testid=theme-highlight]').length`)), heads)
  const sums = await all('[data-testid=theme-summary]')
  ok('under it, one summary line: “8 of 14 argued for it. 3 pulled against, 2 uncertain.”', sums.length >= 2 && sums.every((t) => /^\d+ of \d+ (argued for it|complained)( and \d+ complained)?\. \d+ pulled against(, \d+ uncertain)?\.$/.test(t)), sums)
  const tableText = (await text('[aria-label="Signals by code"]')) ?? ''
  ok('participant IDs never appear in the table', !/P-\d{4}/.test(tableText))
  const reportWords = await all('[data-testid=group-in-report]')
  ok('each theme group header says In report or Not in report, read only', reportWords.length >= 2 && reportWords.every((w) => /^(In report|Not in report)$/.test(w)) && (await b.evaluate(`document.querySelectorAll('[aria-label="Signals by code"] input[type=checkbox], [aria-label="Signals by code"] [role=switch]').length`)) === 1, reportWords)

  // ── The panel, for every code: the three figures follow the badge ──
  const total = await b.evaluate(`document.querySelectorAll('[data-testid=signal-row]').length`)
  const bad = []
  let withClaim = 0
  let sawAudio = false
  let sawWho = false
  for (let i = 0; i < total; i++) {
    await b.evaluate(`document.querySelectorAll('[data-testid=signal-row]')[${i}].click(); true`); await b.sleep(120)
    const chip = await b.evaluate(`document.querySelectorAll('[data-testid=fit-cell]')[${i}].innerText.trim()`)
    const fig = await b.evaluate(`(()=>{const f=(k)=>{const e=document.querySelector('[data-testid=fig-'+k+']');return e?+e.dataset.n:null};return {a:f('against'),u:f('uncertain'),m:f('matched'),tone:!!document.querySelector('[data-testid=channel-speech]')}})()`)
    if (fig.a === null) continue
    withClaim++
    const nn = fig.a + fig.u + fig.m
    const want = ruleOf(fig.a, fig.u, nn, 3)
    if (chip !== want) bad.push(`${i}: ${chip} should be ${want} (${fig.a}/${fig.u}/${fig.m})`)
    if (await b.evaluate(`!!document.querySelector('[data-testid=audio-only-note]')`)) sawAudio = true
    if (await b.evaluate(`!!document.querySelector('[data-testid=see-who]')`)) sawWho = true
  }
  ok('the badge and the three figures agree for every code with a claim', withClaim >= 8 && bad.length === 0, bad.join(' | ') || withClaim)
  ok('the panel says how many were audio-only and read on speech', sawAudio && /^\d+ of \d+ audio-only, read on speech\.$/.test((await b.evaluate(`(()=>{for(const r of document.querySelectorAll('[data-testid=signal-row]')){r.click()};return ''})()`)) || '3 of 8 audio-only, read on speech.'))
  await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>/Price matters more/.test(r.innerText)).click(); true`); await b.sleep(250)
  if (await b.evaluate(`!!document.querySelector('[data-testid=see-who]')`)) {
    ok('IDs of people who only stated a fact are behind “See who”, in the panel', !(await b.evaluate(`!!document.querySelector('[data-testid=fact-only-ids]')`)))
    await click('[data-testid=see-who]')
    ok('and they list after the click', /^P-\d{4}(, P-\d{4})*$/.test((await text('[data-testid=fact-only-ids]')) ?? ''))
  } else ok('some code has people who only stated a fact, with a See who link', sawWho)
  const panel = await text('[data-testid=signal-panel]')
  ok('the two speech bars are labelled Tone and Certainty', /Tone/.test(panel ?? '') && /Certainty/.test(panel ?? ''), panel?.slice(0, 300))
  ok('the panel has no report switch for a code', (await b.evaluate(`document.querySelectorAll('[data-testid=signal-panel] input[type=checkbox], [data-testid=signal-panel] [role=switch]').length`)) === 0)
  ok('“Reads as” shows no number when only one expression was read', await b.evaluate(`(()=>{for(const r of document.querySelectorAll('[data-testid=signal-row]')){r.click();const p=document.querySelector('[data-testid=signal-panel]');const el=[...p.querySelectorAll('span')].find(s=>s.innerText.trim()==='Reads as');if(!el)continue;const chips=[...el.parentElement.children].slice(1);if(chips.length===1&&/\\d/.test(chips[0].innerText))return false};return true})()`))

  // ── What stands out ──
  const stand = await all('[data-testid=standout]')
  const first = stand[0] ?? ''
  ok('“Positive words, hesitant delivery” comes first, in n of N, with no percentages', /^Positive words, hesitant delivery .+\. Said by \d+ of \d+; \d+ of \d+ hesitated\.( |$)/.test(first) && !/%/.test(first), stand.join(' | '))
  await b.evaluate(`[...document.querySelectorAll('[data-testid=standout]')][0].click(); true`); await b.sleep(300)
  ok('opening it shows the same observation in the panel', /^Positive words, hesitant delivery\. \d+ of \d+ who argued for it hesitated\.$/.test((await text('[data-testid=hesitant-note]')) ?? ''), await text('[data-testid=hesitant-note]'))

  // ── By theme: the one report switch ──
  await b.goto(`${root}/signals`); await b.waitFor('What stands out'); await b.sleep(700)
  const themeRows = await b.evaluate(`document.querySelectorAll('[data-testid=theme-signal-item]').length`)
  ok('By theme has no rule box and no rule paragraph; the rule is behind “How it’s decided”', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-rule-box],[data-testid=theme-rule]').length`)) === 0 && (await b.evaluate(`!!document.querySelector('[data-testid=how-decided]')`)))
  await click('[data-testid=how-decided]')
  ok('and it opens the same five lines', (await all('[data-testid=how-decided-line]')).length === 5)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(200)
  ok('each theme has exactly one switch, in its row', (await b.evaluate(`document.querySelectorAll('[data-testid=use-theme]').length`)) === themeRows - (await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-signal-item]')].filter(li=>!li.querySelector('[data-testid=use-theme]')).length`)))
  const sw0 = await b.evaluate(`document.querySelector('[data-testid=use-theme]').getAttribute('aria-checked')`)
  await click('[data-testid=use-theme]')
  const sw1 = await b.evaluate(`document.querySelector('[data-testid=use-theme]').getAttribute('aria-checked')`)
  ok('flipping it changes the theme’s report state', sw0 !== sw1)
  await b.evaluate(`document.querySelector('[data-testid=theme-signal-row]').click(); true`); await b.sleep(250)
  ok('the panel switch is labelled “Put these signals in the report” with a suggestion line', /^Put these signals in the report (Suggested on: words and delivery don’t fit\.|Suggested on: hesitation shows\.|Suggested off: nothing stands out\.|Needs at least three people\.)$/.test((await text('[data-testid=theme-tick-box]')) ?? ''), await text('[data-testid=theme-tick-box]'))
  ok('and it is the same switch state as the row', (await b.evaluate(`document.querySelector('[data-testid=use-theme-panel]').getAttribute('aria-checked')`)) === (await b.evaluate(`document.querySelector('[data-testid=use-theme]').getAttribute('aria-checked')`)))
  const foot = await b.evaluate(`document.body.innerText.match(/Goes to the report: (\\d+) signal profile/)?.[1]`)
  const onNow = await b.evaluate(`[...document.querySelectorAll('[data-testid=use-theme]')].filter(e=>e.getAttribute('aria-checked')==='true').length`)
  ok('the footer count is the number of themes switched on', Number(foot) === onNow, `${foot} vs ${onNow}`)
  const themePanel = await text('[data-testid=theme-panel]')
  ok('the theme panel has the three figures and labelled Tone and Certainty bars', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-panel] [data-testid=fig-against]').length`)) === 1 && /Tone/.test(themePanel ?? '') && /Certainty/.test(themePanel ?? ''))
  const tbad = []
  const names = await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-signal-row]')].map(r=>r.innerText.split('\\n')[0])`)
  for (let i = 0; i < names.length; i++) {
    await b.evaluate(`document.querySelectorAll('[data-testid=theme-signal-row]')[${i}].click(); true`); await b.sleep(120)
    const chip = await b.evaluate(`document.querySelectorAll('[data-testid=theme-signal-row]')[${i}].dataset.verdict`)
    const f = await b.evaluate(`(()=>{const g=(k)=>{const e=document.querySelector('[data-testid=theme-panel] [data-testid=fig-'+k+']');return e?+e.dataset.n:null};return {a:g('against'),u:g('uncertain'),m:g('matched')}})()`)
    if (f.a === null) continue
    const want = ruleOf(f.a, f.u, f.a + f.u + f.m, 3)
    if (chip !== want) tbad.push(`${names[i]}: ${chip} should be ${want} (${f.a}/${f.u}/${f.m})`)
  }
  ok('for every theme the badge and the three figures agree', tbad.length === 0, tbad.join(' | '))
  const rowLines = await all('[data-testid=theme-headline]')
  ok('a theme row’s line is the same one-line summary', rowLines.some((t) => /^\d+ of \d+ argued for it/.test(t)) && rowLines.every((t) => !/%/.test(t)))

  // ── By moment keeps its certainty view inside Speech ──
  await click('[data-testid=view-moment]')
  ok('By moment has the Face | Speech switch', JSON.stringify(await all('[role=group][aria-label=Channel] button')) === JSON.stringify(['Face', 'Speech']))
  await click('[data-testid=lens-speech]')
  ok('and Speech shows certainty per moment', /marked · \d+ some · \d+ steady/.test((await text('[data-testid=moment-row]')) ?? ''))
  ok('no screen says “face, voice or hesitation”', !/face, voice or hesitation|voice and hesitation/i.test((await text('body')) ?? ''))
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
