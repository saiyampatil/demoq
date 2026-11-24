// A2 Concepts, the logic (commit 2A): Said, Did and Showed with their own bases, ties, no warm reading, audio-only, consent, under five on
// video, no choice task, rotation, the Differs rule, the line and its validator, fingerprints and decisions, the reveal window, text signals.
// Runs the real modules through Vite's SSR loader (no browser):   node tests/a2-concepts.mjs
import { createServer } from 'vite'

const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' })
const m = (p) => vite.ssrLoadModule(p)
const cn = await m('/src/state/concepts.ts')
const cb = await m('/src/state/codebook.ts')
const ms = await m('/src/mock/signals.ts')
const mc = await m('/src/mock/concepts.ts')
const fx = await m('/src/mock/conceptFixtures.ts')
const cfg = await m('/src/config/concepts.ts')
const sp = await m('/src/state/speech.ts')
const em = await m('/src/mock/emotion.ts')

const failures = []
let n = 0
const ok = (label, cond, detail) => {
  n++
  if (!cond) failures.push(detail === undefined ? label : `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})`)
}
const A = 'm-concept-a', B = 'm-concept-b', C = 'm-concept-c'
const concepts = [A, B, C].map((id, i) => ({ id, name: `Concept ${'ABC'[i]}` }))
const person = (id, o = {}) => ({ participantId: id, saw: o.saw ?? [A, B, C], video: o.video ?? true, consent: o.consent ?? true, readings: o.readings ?? [], said: o.said, did: o.did })
const rd = (conceptId, label, intensity = 'Medium', confidence = 0.8) => ({ conceptId, label, intensity, confidence })
const input = (people, o = {}) => ({ concepts, people, hasChoiceTask: o.choice ?? true, saidAvailable: o.said ?? { [A]: true, [B]: true, [C]: true } })
const by = (rows, id) => rows.find((r) => r.id === id)

// ── Showed: each person's warmest first reaction ──
{
  const w = (readings, o = {}) => cn.warmest(person('P-1', { readings, ...o }))
  ok('Delight beats Interest, whatever the intensity', w([rd(A, 'Interest', 'High'), rd(B, 'Delight', 'Low')]) === B)
  ok('within a label, the stronger intensity wins', w([rd(A, 'Delight', 'Medium'), rd(B, 'Delight', 'High')]) === B && w([rd(A, 'Interest', 'Low'), rd(B, 'Interest', 'Medium')]) === B)
  ok('a tie counts for no concept', w([rd(A, 'Delight', 'High'), rd(B, 'Delight', 'High')]) === null && w([rd(A, 'Interest', 'Low'), rd(B, 'Interest', 'Low'), rd(C, 'Neutral')]) === null)
  ok('a tie that is not at the top does not matter', w([rd(A, 'Delight', 'High'), rd(B, 'Interest', 'Low'), rd(C, 'Interest', 'Low')]) === A)
  ok('no warm reading counts for none: neutral, doubt, confusion, surprise', w([rd(A, 'Neutral', 'Low'), rd(B, 'Doubt'), rd(C, 'Confusion')]) === null && w([rd(A, 'Surprise', 'High')]) === null)
  ok('a reading below medium confidence is not used', w([rd(A, 'Delight', 'High', 0.59), rd(B, 'Interest', 'Low', 0.6)]) === B && w([rd(A, 'Delight', 'High', 0.5)]) === null)
  ok('only the concepts they saw count', w([rd(A, 'Delight', 'High'), rd(B, 'Interest')], { saw: [B, C] }) === B)
  ok('audio-only people are never read', w([rd(A, 'Delight', 'High')], { video: false }) === null)
  ok('people who did not consent are never read', w([rd(A, 'Delight', 'High')], { consent: false }) === null)
}

// ── bases: each concept has its own ──
{
  const people = [
    person('P-1', { saw: [A, B], readings: [rd(A, 'Delight', 'High'), rd(B, 'Interest')], said: A, did: A }),
    person('P-2', { saw: [A, B], readings: [rd(A, 'Interest'), rd(B, 'Delight')], said: B, did: B }),
    person('P-3', { saw: [B, C], video: false, said: C, did: C }),
    person('P-4', { saw: [B, C], consent: false, readings: [], said: B, did: B }),
    person('P-5', { saw: [A, C], readings: [rd(A, 'Neutral', 'Low'), rd(C, 'Interest', 'High')], said: A, did: C }),
    person('P-6', { saw: [A, C], readings: [rd(A, 'Delight'), rd(C, 'Delight')], said: C }),
  ]
  const rows = cn.computeConcepts(input(people))
  const a = by(rows, A), b = by(rows, B), c = by(rows, C)
  ok('Said and Did are of the people who saw the concept, so bases differ', a.said.of === 4 && b.said.of === 4 && c.said.of === 4 && a.saw === 4, [a.said, b.said, c.said])
  ok('Said counts people who picked it first among those who saw it', a.said.n === 2 && b.said.n === 2 && c.said.n === 2, [a.said, b.said, c.said])
  ok('Did is of the people who saw it and finished the task (P-6 did not)', c.did.of === 3 && c.did.n === 2 && a.did.of === 3 && a.did.n === 1, [a.did, c.did])
  ok('Showed is of people on video who consented and saw it: its own base per concept', a.showed.of === 4 && b.showed.of === 2 && c.showed.of === 2, [a.showed.of, b.showed.of, c.showed.of])
  ok('Showed counts each person once, at their warmest concept (a tie, P-6, counts for none)', a.showed.n === 1 && b.showed.n === 1 && c.showed.n === 1, [a.showed, b.showed, c.showed])
  ok('audio-only P-3 and no-consent P-4 are in no Showed base (4, 2 and 2 are the people on video who consented and saw each)', rows.map((r) => r.showed.of).join() === '4,2,2')
}

// ── under five on video, no choice task, said not available ──
{
  const few = cn.computeConcepts(input([1, 2, 3, 4].map((i) => person(`P-${i}`, { readings: [rd(A, 'Delight', 'High')], said: A, did: A })).concat([person('P-5', { video: false, said: B, did: B })]))) 
  ok('with fewer than five on video, Showed is greyed and left out of the match', few.every((r) => r.showed.greyed && !r.measures.includes('showed')) && few.every((r) => r.measures.join() === 'said,did'), few.map((r) => [r.showed.greyed, r.measures]))
  ok('greyed Showed still carries its numbers, so the screen can show them greyed', by(few, A).showed.of === 4 && by(few, A).showed.n === 4)
  const five = cn.computeConcepts(input([1, 2, 3, 4, 5].map((i) => person(`P-${i}`, { readings: [rd(A, 'Delight', 'High')], said: A, did: A }))))
  ok('with exactly five on video it is not greyed', five.every((r) => !r.showed.greyed))
  const noTask = cn.computeConcepts(input([1, 2, 3, 4, 5, 6].map((i) => person(`P-${i}`, { readings: [rd(A, 'Delight', 'High')], said: i % 2 ? A : B })), { choice: false }))
  ok('with no choice task Did does not exist, and the measures are Said and Showed', noTask.every((r) => r.did === undefined && r.measures.join() === 'said,showed'), noTask.map((r) => r.measures))
  const noSaid = cn.computeConcepts(input([1, 2, 3, 4, 5, 6].map((i) => person(`P-${i}`, { readings: [rd(A, 'Delight', 'High')], did: A })), { said: { [A]: true, [B]: false, [C]: true } }))
  ok('Said is left out of the match when one concept’s code is not accepted yet, and that concept has no Said', noSaid.every((r) => !r.measures.includes('said')) && by(noSaid, B).said === undefined && by(noSaid, A).said !== undefined)
  const one = cn.computeConcepts(input([1, 2, 3].map((i) => person(`P-${i}`, { said: A })), { choice: false }))
  ok('with fewer than two measures a concept neither agrees nor differs, and has no line', one.every((r) => r.match === 'Not enough' && cn.conceptLine(r) === null))
}

// ── Differs ──
{
  const make = (said, did, showedWinners) => {
    const people = []
    let i = 0
    for (const [c, k] of Object.entries(said)) for (let j = 0; j < k; j++) people.push(person(`P-${++i}`, { said: c }))
    people.forEach((p, idx) => { p.did = did[idx % did.length]; p.readings = [rd(showedWinners[idx % showedWinners.length], 'Delight', 'High')] })
    return cn.computeConcepts(input(people))
  }
  const rows = make({ [A]: 6, [B]: 3, [C]: 3 }, [C, C, B], [C])
  ok('Differs needs the ranks to move by two places and the shares to be at least 0.2 apart', by(rows, A).match === 'Differs' && by(rows, A).rankGap === 2 && by(rows, A).spread >= cfg.CONCEPTS.differs.minSpread, rows.map((r) => [r.name, r.match, r.rankGap, r.spread]))
  const close = make({ [A]: 4, [B]: 4, [C]: 4 }, [A, B, C], [A, B, C])
  ok('three concepts that line up agree', close.every((r) => r.match === 'Agrees'), close.map((r) => [r.match, r.ranks]))
  const gapOnly = cn.computeConcepts(input([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => person(`P-${i}`, { said: i <= 4 ? A : i <= 7 ? B : C, did: i <= 4 ? C : i <= 7 ? B : A, readings: [rd(i <= 5 ? B : C, 'Delight', 'High')] }))))
  ok('a rank move with shares too close does not count as Differs (the spread rule)', gapOnly.every((r) => r.rankGap < 2 || r.spread >= 0.2 || r.match === 'Agrees'), gapOnly.map((r) => [r.name, r.match, r.rankGap, +r.spread.toFixed(2)]))
  const strict = cn.computeConcepts(input([1, 2, 3, 4, 5, 6].map((i) => person(`P-${i}`, { said: A, did: C, readings: [rd(C, 'Delight', 'High')] }))), cfg.CONCEPTS)
  ok('the thresholds are in config', cfg.CONCEPTS.differs.rankGap === 2 && cfg.CONCEPTS.differs.minSpread === 0.2 && cfg.CONCEPTS.showedMinVideo === 5 && cfg.CONCEPTS.minConfidence === 0.6 && cfg.CONCEPTS.windowSec === 5 && strict.length === 3)
  const two = cn.computeConcepts({ concepts: concepts.slice(0, 2), people: [1, 2, 3, 4, 5, 6].map((i) => person(`P-${i}`, { saw: [A, B], said: A, did: B, readings: [rd(B, 'Delight', 'High')] })), hasChoiceTask: true, saidAvailable: { [A]: true, [B]: true } })
  ok('with two concepts the largest possible rank move is one place, so the rule still lets them differ', two.some((r) => r.match === 'Differs'), two.map((r) => [r.match, r.rankGap, r.spread]))
}

// ── rotation: a made-up study where each person saw two of three ──
{
  const rot = fx.rotatedStudy()
  const rows = cn.computeConcepts(rot)
  ok('in a rotated study every concept is seen by 16 of 24', rows.every((r) => r.saw === 16) && rows.every((r) => r.said.of === 16 && r.did.of === 16))
  ok('and each concept’s Showed base is its own: the people on video, with consent, who saw it', rows.every((r) => r.showed.of === rot.people.filter((p) => p.saw.includes(r.id) && p.video && p.consent).length), rows.map((r) => r.showed))
  ok('no base is the whole sample of 24', rows.every((r) => r.said.of < 24 && r.did.of < 24 && r.showed.of < 24))
  ok('a person is counted once in Showed across the concepts they saw', rows.reduce((a, r) => a + r.showed.n, 0) <= rot.people.filter((p) => p.video && p.consent).length)
  const cov = cn.coverageOf(rot)
  ok('coverage counts audio-only and no-consent people apart', cov.people === 24 && cov.audioOnly === 12 && cov.noConsent === 2 && cov.onVideo === 10, cov)
  const line = rows.map(cn.conceptLine)
  ok('every concept in the rotated study has a line that passes the validator', line.every((l) => l && cn.checkConceptLine(l).ok), line)
}

// ── the real studies ──
const docOf = (id) => {
  const ppl = ms.acceptedParticipants(id)
  return { doc: cb.seedCodebook(id, ppl.map(ms.sessionOfParticipant)), basis: cb.basisOf(ppl.map((p) => ({ id: ms.sessionOfParticipant(p), participantId: p }))), ppl }
}
{
  const { doc, basis, ppl } = docOf('ice-cream-flavours')
  const r = cn.conceptRows(doc, basis)
  const figs = r.rows.map((x) => [x.name, `${x.said.n}/${x.said.of}`, `${x.did.n}/${x.did.of}`, `${x.showed.n}/${x.showed.of}`, x.match])
  // From the design data (docs/stitch/ICE_CREAM_MOCK_DATA.md, section 0): Said 8/5/7 of 20, Did 10/3/7 of 20, Showed 1/9/5 of the 15 on video.
  ok('Ice Cream: Said 8, 5, 7 of 20; Did 10, 3, 7 of 20; Showed 1, 9, 5 of 15', JSON.stringify(figs) === JSON.stringify([['Salted Caramel Swirl', '8/20', '10/20', '1/15', 'Differs'], ['Mango Lassi', '5/20', '3/20', '9/15', 'Differs'], ['Cookie Dough Crunch', '7/20', '7/20', '5/15', 'Agrees']]), figs)
  // Showed, written out again here from the raw readings, separately from state/concepts.ts
  const study = mc.conceptStudyOf('ice-cream-flavours')
  const rank = { Delight: 20, Interest: 10 }, lvl = { Low: 1, Medium: 2, High: 3 }
  const tally = { [A]: 0, [B]: 0, [C]: 0 }
  const pool = { [A]: 0, [B]: 0, [C]: 0 }
  for (const p of ppl) {
    const rs = study.concepts.map((c) => mc.revealReading('ice-cream-flavours', p, c.id)).filter(Boolean)
    rs.forEach((x) => pool[x.conceptId]++)
    const warm = rs.filter((x) => (x.label === 'Delight' || x.label === 'Interest') && x.confidence >= 0.6).map((x) => [rank[x.label] + lvl[x.intensity], x.conceptId]).sort((a, b) => b[0] - a[0])
    if (warm.length && (warm.length === 1 || warm[0][0] !== warm[1][0])) tally[warm[0][1]]++
  }
  ok('Showed matches an independent count from the raw first reactions, with its own base per concept', r.rows.every((x) => x.showed.n === tally[x.id] && x.showed.of === pool[x.id]), [tally, pool])
  ok('coverage: 15 of 20 read at a reveal, 5 audio-only, none without consent', r.coverage.read === 15 && r.coverage.audioOnly === 5 && r.coverage.noConsent === 0 && r.coverage.onVideo === 15, r.coverage)
  ok('the audio-only people (P-4116 to P-4120) have no reading at any reveal, and every person on video has three', ['P-4116', 'P-4117', 'P-4118', 'P-4119', 'P-4120'].every((p) => study.concepts.every((c) => !mc.revealReading('ice-cream-flavours', p, c.id))) && ppl.filter((p) => em.hasVideo(p)).every((p) => study.concepts.every((c) => !!mc.revealReading('ice-cream-flavours', p, c.id))))
  ok('everyone saw every concept, so each concept is seen by 20 of 20 (a failed card is tested on Pet Food)', [A, B, C].every((c) => by(r.rows, c).saw === 20))
  ok('Ice Cream has a choice task, so Did is there; Caramel is the one that differs', r.hasChoiceTask && r.rows.filter((x) => x.match === 'Differs').map((x) => x.name).join() === 'Salted Caramel Swirl,Mango Lassi')
  const lines = r.rows.map((x) => x.line)
  ok('every line passes the shared validator, with one claim and two figures', lines.every((l) => l && cn.checkConceptLine(l).ok && /\d+ of \d+/.test(l)), lines.map((l) => cn.checkConceptLine(l).problems))
  ok('the three lines are the design data’s, one sentence each with two figures', lines[0] === '10 of 20 chose Salted Caramel Swirl to take home, but it drew the warmest first reaction for only 1 of 15 on video.' && lines[1] === 'Mango Lassi drew the warmest first reaction for 9 of 15 on video, but only 3 of 20 chose it to take home.' && lines[2] === 'Cookie Dough Crunch drew the warmest first reaction for 5 of 15 on video, and 7 of 20 chose it to take home.', lines)
  ok('two shares within 0.1 are said with “and”, not “but only”', /, and 7 of 20 chose it to take home\.$/.test(lines[2]), lines[2])
}
{
  const { doc, basis } = docOf('pet-food-churn')
  const r = cn.conceptRows(doc, basis)
  ok('Pet Food has no choice task: Did is absent and the screen hides its column', !r.hasChoiceTask && r.rows.every((x) => x.did === undefined))
  ok('only Pause’s code is accepted, so only Pause has a Said; the others wait on the codebook', r.rows[0].said?.n === 6 && r.rows[1].said === undefined && r.rows[2].said === undefined)
  ok('with one measure left, no concept agrees or differs, and each says Nothing to decide', r.rows.every((x) => x.match === 'Not enough' && x.line === null && x.decision.status === 'Nothing to decide'), r.rows.map((x) => [x.match, x.decision.status]))
  ok('Pet: P-3106 never saw Recipe swap and P-3114 did not consent', !r.input.people.find((p) => p.participantId === 'P-3106').saw.includes(B) && !mc.revealReading('pet-food-churn', 'P-3114', A))
  const accepted = cb.acceptCodes(doc, ['c-idea-swap', 'c-idea-portion'], { by: 'Maya Ortiz' })
  const r2 = cn.conceptRows(accepted, basis)
  ok('once the other two codes are accepted, Said exists for all three and the match is read', r2.rows.every((x) => x.said && x.measures.join() === 'said,showed' && x.match !== 'Not enough' && x.line), r2.rows.map((x) => [x.said, x.match]))
}

// ── the reveal window: never while the person is speaking ──
{
  let count = 0
  const bad = []
  for (const id of ['pet-food-churn', 'ice-cream-flavours']) {
    const { ppl } = docOf(id)
    for (const c of mc.conceptStudyOf(id).concepts) for (const p of ppl) {
      const x = mc.revealReading(id, p, c.id)
      if (!x) continue
      count++
      if (!(x.onsetSec >= 0.2 && x.onsetSec < x.speechStartSec && x.onsetSec <= cfg.CONCEPTS.windowSec && x.windowSec <= cfg.CONCEPTS.windowSec && x.confidence > 0 && x.cue.length > 5 && x.revealAtSec > 0)) bad.push(`${id} ${p} ${c.id} ${JSON.stringify(x)}`)
    }
  }
  ok('every reveal reading falls inside the first five seconds and before the person spoke, with label, intensity, confidence and a visible cue', count > 50 && bad.length === 0, bad.slice(0, 2))
  ok('a reading that would have landed after they began speaking is moved before it, never dropped', (() => { const x = mc.revealReading('pet-food-churn', 'P-3103', A); return x.onsetSec < x.speechStartSec })())
}

// ── decisions and fingerprints ──
{
  const { doc, basis } = docOf('ice-cream-flavours')
  const who = { by: 'Maya Ortiz' }
  const rows = (d) => cn.conceptRows(d, basis).rows
  const caramel = rows(doc)[0]
  ok('before a decision a concept’s line is Suggested', caramel.decision.status === 'Suggested')
  const cur = (r) => r.now
  const ref = (r) => ({ id: r.key, name: r.name })
  const accepted = cb.acceptInsight(doc, ref(caramel), cur(caramel), who)
  const d1 = accepted.insights['concept:m-concept-a']
  ok('accepting records who, when, the fingerprint and the data version, under the concept’s own key', d1.status === 'Accepted' && d1.by === 'Maya Ortiz' && d1.fingerprint === caramel.now.fingerprint && d1.dataVersion === 1 && rows(accepted)[0].decision.status === 'Accepted')
  const wording = caramel.line.replace('drew the warmest first reaction', 'got the warmest first reaction')
  ok('an edit may change the wording but not the numbers, and may carry two figures', sp.checkInsightEdit(wording, caramel.line, { figuresAllowed: 2 }).length === 0 && sp.checkInsightEdit(caramel.line.replace('1 of 15', '2 of 15'), caramel.line, { figuresAllowed: 2 }).some((p) => /numbers are locked/i.test(p)) && sp.checkInsightEdit(caramel.line, caramel.line).some((p) => /More than one/.test(p)))
  const edited = cb.editInsight(accepted, ref(caramel), cur(caramel), wording, who)
  ok('an edit is Edited and keeps the same fingerprint, so it stays current', rows(edited)[0].decision.status === 'Edited' && edited.insights['concept:m-concept-a'].fingerprint === d1.fingerprint)
  // change the data under it: one person who chose Cookie now chose Caramel
  const picks = mc.conceptStudyOf('ice-cream-flavours').choice.picks
  const was = picks['P-4102']
  picks['P-4102'] = A
  const after = rows(accepted)[0]
  picks['P-4102'] = was
  ok('when the data moves after a decision, the line is Out of date and shows old and new', after.decision.status === 'Out of date' && after.decision.was.text === caramel.line && after.decision.now.text === after.line && after.line !== caramel.line, after.decision)
  ok('and it is current again when the data is back', rows(accepted)[0].decision.status === 'Accepted')
  const left = cb.leaveOutInsight(doc, ref(caramel), cur(caramel), who, 'Not for the report.')
  ok('leaving out keeps the reason, and a left-out line stays left out', rows(left)[0].decision.status === 'Left out' && left.insights['concept:m-concept-a'].why === 'Not for the report.')
  ok('a different concept’s decision does not touch this one’s', rows(accepted)[1].decision.status === 'Suggested' && rows(accepted)[2].decision.status === 'Suggested')
}

// ── clips and people ──
{
  const { doc, basis } = docOf('ice-cream-flavours')
  const r = cn.conceptRows(doc, basis)
  const { clips, total } = cn.clipsOf(r.input, B)
  ok('a concept lists at most five first reactions, warmest first, each “reads as” a label with a cue and a time', clips.length === 5 && total === 15 && clips.every((c, i) => c.rank === i + 1 && c.reading.cue && c.reading.label && c.reading.revealAtSec > 0), clips.map((c) => [c.participantId, c.reading.label, c.reading.intensity]))
  const order = { Delight: 7, Interest: 6, Surprise: 5, Neutral: 4, Confusion: 3, Doubt: 2, Frustration: 1 }
  ok('they are ranked warmest first: Delight above Interest, then by intensity', clips.every((c, i) => i === 0 || order[clips[i - 1].reading.label] >= order[c.reading.label]))
  ok('audio-only people and people without consent are in no list', !clips.some((c) => ['P-4116', 'P-4117', 'P-4118', 'P-4119', 'P-4120'].includes(c.participantId)) && cn.clipsOf(r.input, A, 99).clips.every((c) => em.hasVideo(c.participantId)))
  const who = cn.peopleBehind(r.input, C, 'did')
  ok('the people behind a measure are the ones counted in it', who.length === by(r.rows, C).did.n && cn.peopleBehind(r.input, A, 'said').length === 8 && cn.peopleBehind(r.input, B, 'showed').length === by(r.rows, B).showed.n)
}

// ── text signals ──
{
  const { doc, basis } = docOf('ice-cream-flavours')
  const hedge = /\b(maybe|i guess|sort of|kind of|probably|i think|not sure|perhaps|i suppose|a bit|somewhat|might)\b/i
  const ids = doc.codes.map((c) => c.id)
  let anyH = 0, anyR = 0
  const bad = []
  for (const id of ids) {
    const code = doc.codes.find((c) => c.id === id)
    const quotes = cb.liveExcerpts(code, basis)
    const people = [...new Set(quotes.map((e) => e.participantId))]
    const wantH = people.filter((p) => quotes.some((e) => e.participantId === p && hedge.test(e.text))).length
    const wantR = people.filter((p) => `${p}|${id}` in mc.EARLY_MENTION).length
    const got = cn.textSignalsOf(code, doc, basis)
    if (got.hedged.n !== wantH || got.hedged.of !== people.length || got.raised.n !== wantR || got.raised.of !== people.length) bad.push(id)
    anyH += wantH
    anyR += wantR
  }
  ok('Hedged n of N and Raised before asked n of N match an independent count over the quotes and the mock mentions', bad.length === 0 && anyH >= 1 && anyR >= 3, [bad, anyH, anyR])
  const stray = Object.keys(mc.EARLY_MENTION).filter((k) => { const [p, c] = k.split('|'); const code = [...docOf('ice-cream-flavours').doc.codes, ...docOf('pet-food-churn').doc.codes].find((x) => x.id === c); return !code || !code.excerpts.some((e) => cb.excerpt(e).participantId === p) })
  ok('every mock early mention is by someone who really said that code', stray.length === 0, stray)
  const before = JSON.stringify((await m('/src/state/signals.ts')).codeSignals(doc, basis).map((s) => [s.code.id, s.fit]))
  cn.textSignalsOf(doc.codes[0], doc, basis)
  ok('text signals are observations only: they change no verdict', before === JSON.stringify((await m('/src/state/signals.ts')).codeSignals(doc, basis).map((s) => [s.code.id, s.fit])))
}

await vite.close()
if (failures.length) {
  console.log(`${n} checks, ${failures.length} failed\nA2 CONCEPTS FAILED:\n - ${failures.join('\n - ')}`)
  process.exit(1)
}
console.log(`${n} checks, 0 failed\nA2 CONCEPTS OK`)
