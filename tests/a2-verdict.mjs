// A2: the speech-only verdict, stance per code, the insight sentence, "What stood out", moments to watch, and decisions on an insight.
// This is logic, so it runs the real modules through Vite's SSR loader (no browser, no dev server needed):
//   node tests/a2-verdict.mjs
import { createServer } from 'vite'

const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' })
const m = (p) => vite.ssrLoadModule(p)
const sp = await m('/src/state/speech.ts')
const sg = await m('/src/state/signals.ts')
const cb = await m('/src/state/codebook.ts')
const ms = await m('/src/mock/signals.ts')
const nr = await m('/src/state/narration.ts')
const cfg = await m('/src/config/delivery.ts')

const failures = []
let n = 0
const ok = (label, cond, detail) => {
  n++
  if (!cond) failures.push(detail === undefined ? label : `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})`)
}

// A point is one quote. `tone` and `band` are the speech; `face` is stored and must never matter.
let seq = 0
const pt = (who, o = {}) => ({
  key: `k${seq++}`,
  participantId: `P-${who}`,
  sessionId: `S${who}`,
  segment: 'A',
  atSec: o.at ?? 100 + seq,
  facts: o.facts ?? { delaySec: 1, pauseSec: 0, fillers: 0 },
  usual: o.usual ?? 1,
  band: o.band ?? 'Steady',
  reason: 'r',
  voice: { tone: o.tone ?? 'Even', pace: o.pace ?? 100, usualPace: 100, pitch: o.pitch ?? 5, usualPitch: 5, loudness: 0, reason: 'v' },
  stance: o.stance ?? 'Positive',
  face: o.face === undefined ? { emotion: 'Neutral', intensity: 'Low', confidence: 0.9, cue: 'c', onsetSec: 1 } : o.face === null ? undefined : { emotion: o.face, intensity: 'High', confidence: 0.95, cue: 'c', onsetSec: 1 },
  excerpt: { text: `quote ${who}` },
})
const team = (count, f) => Array.from({ length: count }, (_, i) => pt(i + 1, f(i)))
const split = (points) => sp.fitSplit(points, {})

// ── one quote against its words ──
{
  const fit = (o) => sp.fitOf(pt(1, o)).fit
  ok('for it: tense and flat are No match; animated and even match', fit({ tone: 'Tense' }) === 'Pulls against' && fit({ tone: 'Flat' }) === 'Pulls against' && fit({ tone: 'Animated' }) === 'Matches' && fit({ tone: 'Even' }) === 'Matches')
  ok('against it: animated is No match; tense, flat and even match', fit({ stance: 'Negative', tone: 'Animated' }) === 'Pulls against' && ['Tense', 'Flat', 'Even'].every((t) => fit({ stance: 'Negative', tone: t }) === 'Matches'))
  ok('marked hesitation with nothing else off is Hesitant, never No match', fit({ band: 'Marked hesitation' }) === 'Uncertain' && fit({ band: 'Some hesitation' }) === 'Matches')
  ok('marked hesitation with a contradicting tone is No match (the tone is the reason)', fit({ band: 'Marked hesitation', tone: 'Flat' }) === 'Pulls against')
  ok('just describing has no position to check', fit({ stance: 'Neutral', tone: 'Tense' }) === undefined)
  const faces = ['Doubt', 'Frustration', 'Confusion', 'Delight', 'Interest', 'Surprise', 'Neutral', null]
  const same = faces.every((f) => ['Even', 'Tense', 'Animated'].every((t) => ['Positive', 'Negative'].every((s) => sp.fitOf(pt(1, { face: f, tone: t, stance: s })).fit === sp.fitOf(pt(1, { face: null, tone: t, stance: s })).fit)))
  ok('no face reading, including confusion, ever changes a fit', same)
  const hes = team(10, () => ({ band: 'Marked hesitation', face: 'Interest' }))
  const r = split(hes)
  ok('ten people who hesitated, with calm voices, are all Hesitant: never a Gap', r.against === 0 && r.uncertain === 10 && r.pattern === 'Mixed', r)
  ok('audio-only people (no face) are read on speech like everyone else', sp.fitOf(pt(1, { face: null, tone: 'Tense' })).fit === 'Pulls against' && sp.fitOf(pt(1, { face: null })).fit === 'Matches')
}

// ── one person across several positions ──
{
  const codes = (fits) =>
    fits.map((f, i) => pt(1, { at: 10 + i, tone: f === 'no' ? 'Flat' : 'Even', band: f === 'hes' ? 'Marked hesitation' : 'Steady' }))
  const person = (fits) => sp.readPeople(codes(fits))[0].fit
  ok('more than half of a person’s positions No match: No match', person(['no', 'no', 'yes']) === 'Pulls against')
  ok('more than half Matched: Matched', person(['yes', 'yes', 'no']) === 'Matches')
  // A person whose positions point both ways with neither side ahead is "Split across codes": not Matched, not No match, not Hesitant.
  // (Replaces the 1A rule that called them Hesitant. Hesitant is reserved for hesitation.)
  ok('exactly half is never more than half: one No match, one Matched is Split across codes', person(['no', 'yes']) === 'Split')
  ok('two and two is Split too', person(['no', 'no', 'yes', 'yes']) === 'Split')
  ok('a mix with hesitation and a No match and no side ahead is Split', person(['yes', 'yes', 'hes', 'no', 'no']) === 'Split' && person(['hes', 'no']) === 'Split')
  ok('hesitation with nothing contradicting is Hesitant, never Split', person(['hes', 'yes']) === 'Uncertain' && person(['hes', 'hes']) === 'Uncertain' && person(['hes', 'yes', 'yes', 'hes']) === 'Uncertain')
  ok('a person with one position takes that position', person(['hes']) === 'Uncertain' && person(['no']) === 'Pulls against' && person(['yes']) === 'Matches')
  const one = sp.readPeople([...codes(['no', 'yes', 'yes']), pt(2, {})])
  ok('every person is one reading, however many quotes they have', one.length === 2 && one.filter((r) => r.participantId === 'P-1').length === 1)
  const mixedSides = sp.readPeople([pt(1, { at: 1, stance: 'Negative' }), pt(1, { at: 2, stance: 'Positive' }), pt(1, { at: 3, stance: 'Positive' })])[0]
  ok('a person’s side is where most of their positions are', mixedSides.side === 'Positive')
}

// ── a row's verdict ──
{
  const make = (against, uncertain, matched, describe = 0) => [
    ...Array.from({ length: against }, (_, i) => pt(100 + i, { tone: 'Flat' })),
    ...Array.from({ length: uncertain }, (_, i) => pt(200 + i, { band: 'Marked hesitation' })),
    ...Array.from({ length: matched }, (_, i) => pt(300 + i, {})),
    ...Array.from({ length: describe }, (_, i) => pt(400 + i, { stance: 'Neutral' })),
  ]
  const v = (...a) => split(make(...a)).pattern
  ok('more than half No match: Gap (Conflicting)', v(3, 1, 1) === 'Conflicting')
  ok('exactly half No match is not a Gap', v(2, 0, 2) !== 'Conflicting', v(2, 0, 2))
  ok('exactly half Matched is not Consistent', v(1, 1, 2) === 'Mixed' && v(0, 2, 2) === 'Mixed', [v(1, 1, 2), v(0, 2, 2)])
  ok('more than half Matched: Consistent', v(1, 1, 3) === 'Consistent')
  ok('mostly Hesitant is Mixed, not Gap', v(0, 4, 1) === 'Mixed')
  ok('under three people with a position: Too few to read', v(1, 0, 1) === 'Too few to read' && v(0, 0, 2, 3) === 'Too few to read')
  ok('nobody took a side: No position (No claim)', v(0, 0, 0, 5) === 'No claim')
  ok('under three people at all: Too few to read', v(0, 0, 0, 2) === 'Too few to read')
  ok('people who just described it are not in the base', split(make(1, 0, 3, 6)).n === 4)
  const cfgHolds = cfg.DELIVERY.minPeople === 3 && cfg.DELIVERY.majority === 0.5 && cfg.DELIVERY.clauseMin === 3
  ok('the thresholds are in config', cfgHolds)
}

// ── Split across codes ──
{
  const who = (id, fits) => fits.map((f, i) => pt(id, { at: id * 10 + i, tone: f === 'no' ? 'Flat' : 'Even' }))
  const splitter = (id) => who(id, ['no', 'yes'])
  const matched = (id) => who(id, ['yes'])
  const against = (id) => who(id, ['no'])
  const verdict = (people) => split(people.flat())
  const a = verdict([matched(1), matched(2), matched(3)])
  const b = verdict([matched(1), matched(2), matched(3), splitter(4), splitter(5), splitter(6)])
  ok('without anyone split, three matched is Consistent', a.pattern === 'Consistent' && a.n === 3, a)
  ok('three split people are in the base, so three matched is no longer more than half: Mixed (the tie changes the outcome)', b.pattern === 'Mixed' && b.n === 6 && b.split === 3 && b.fits === 3, b)
  const c = verdict([against(1), against(2), against(3), splitter(4), splitter(5), splitter(6)])
  ok('the same for a Gap: three No match and three split is Mixed, not a Gap', c.pattern === 'Mixed' && c.against === 3 && c.split === 3, c)
  ok('split people are in no tile: matched, no match and hesitant never include them', b.fits + b.against + b.uncertain === 3 && b.fits + b.against + b.uncertain + b.split === b.n)
  const d = verdict([matched(1), matched(2), matched(3), matched(4), splitter(5)])
  ok('one split person among five matched does not stop Consistent (4 of 5 is more than half)', d.pattern === 'Consistent' && d.split === 1)
  const e = verdict([splitter(1), splitter(2), splitter(3)])
  ok('split people can only make a verdict Mixed: three split alone is Mixed', e.pattern === 'Mixed')
  const reads = sp.readPeople([...splitter(1), ...matched(2), ...matched(3)])
  const ins = sp.insightOf(reads)
  ok('a split person still has a side, so the insight sentence counts them', ins.positive === 3 && /^3 of 3 people were verbally positive/.test(ins.sentence), ins.sentence)
  const g = sg.sideSummary(reads)
  ok('the side group lists them apart from the tiles', g.groups[0].split.length === 1 && g.groups[0].tiles.Matches.length === 2 && g.groups[0].fits['P-1'] === 'Split')
}

// ── the insight sentence ──
{
  const make = (pos, neg, describe, o = {}) => [
    ...Array.from({ length: pos }, (_, i) => pt(100 + i, { stance: 'Positive', ...(o.pos?.(i) ?? {}) })),
    ...Array.from({ length: neg }, (_, i) => pt(200 + i, { stance: 'Negative', ...(o.neg?.(i) ?? {}) })),
    ...Array.from({ length: describe }, (_, i) => pt(300 + i, { stance: 'Neutral' })),
  ]
  const s = (pts) => sp.insightOf(sp.readPeople(pts))
  const hes = (k) => (i) => (i < k ? { band: 'Marked hesitation' } : {})
  const flat = (k) => (i) => (i >= 6 - k ? { tone: 'Flat' } : {})
  const both = s(make(9, 0, 3, { pos: (i) => ({ ...(i < 4 ? { band: 'Marked hesitation' } : {}), ...(i >= 6 ? { tone: 'Tense' } : {}) }) }))
  ok('more than half for it, both clauses', both.sentence === '9 of 12 people were verbally positive about it, but 4 of those 9 hesitated and 3 sounded flat or tense.', both.sentence)
  ok('more than half for it, clauses under 3 people are left out', s(make(8, 0, 2, { pos: hes(2) })).sentence === '8 of 10 people were verbally positive about it, and their delivery backed it up.', s(make(8, 0, 2, { pos: hes(2) })).sentence)
  ok('only one clause when the other is under 3 people', s(make(8, 0, 2, { pos: hes(4) })).sentence === '8 of 10 people were verbally positive about it, but 4 of those 8 hesitated.', s(make(8, 0, 2, { pos: hes(4) })).sentence)
  ok('more than half against it', s(make(1, 8, 1, { neg: (i) => (i < 4 ? { tone: 'Animated' } : {}) })).sentence === '8 of 10 people were verbally negative about it, and 4 of those 8 sounded animated or hesitated.', s(make(1, 8, 1, { neg: (i) => (i < 4 ? { tone: 'Animated' } : {}) })).sentence)
  ok('against it counts a person once when they sounded animated and hesitated', s(make(0, 7, 0, { neg: (i) => (i < 3 ? { tone: 'Animated', band: 'Marked hesitation' } : {}) })).sentence.includes('3 of those 7'), s(make(0, 7, 0, { neg: (i) => (i < 3 ? { tone: 'Animated', band: 'Marked hesitation' } : {}) })).sentence)
  ok('neither side has more than half', s(make(4, 3, 3)).sentence === '4 people spoke in favour of it and 3 spoke against it.', s(make(4, 3, 3)).sentence)
  ok('exactly half is not more than half', s(make(5, 0, 5)).shape === 'split' && s(make(5, 0, 5)).sentence === '5 people spoke in favour of it.', s(make(5, 0, 5)).sentence)
  ok('nobody took a side', s(make(0, 0, 5)).sentence === 'Nobody took a side. All 5 people just described what happened.', s(make(0, 0, 5)).sentence)
  ok('under three people there is no insight', s(make(2, 0, 0)) === null)
  const all = [both, s(make(8, 0, 2, { pos: hes(2) })), s(make(8, 0, 2, { pos: hes(4) })), s(make(1, 8, 1)), s(make(4, 3, 3)), s(make(5, 0, 5)), s(make(0, 0, 5))]
  ok('every sentence passes the shared validator', all.every((i) => nr.checkNarration(i.sentence).ok), all.map((i) => nr.checkNarration(i.sentence).problems))
  ok('every sentence has one base: at most one “n of N”, no percentages, never “most”', all.every((i) => nr.figures(i.sentence).length <= 1 && !/%|percent|\bmost\b/i.test(i.sentence)))
  ok('the N in “n of N” is everyone who raised it, the n is one side of it', (() => { const f = nr.figures(both.sentence)[0]; return f.of === 12 && f.n === 9 })())
}

// ── what stood out, per code ──
{
  const so = (pts) => sp.standoutOf(sp.readPeople(pts))
  const flatTense = so(team(7, (i) => (i < 4 ? { tone: i % 2 ? 'Flat' : 'Tense' } : {})))
  ok('Flat or tense is named when three or more share it', flatTense?.text === 'Flat or tense 4 of 7', flatTense?.text)
  ok('Hesitated is named with n of N', so(team(6, (i) => (i < 3 ? { band: 'Marked hesitation' } : {})))?.text === 'Hesitated 3 of 6')
  ok('Animated is named', so(team(5, (i) => (i < 3 ? { tone: 'Animated' } : {})))?.text === 'Animated 3 of 5')
  ok('Even is shown when nothing else stands out and three share it', so(team(4, () => ({})))?.text === 'Even 4 of 4')
  ok('under three people share a pattern: a dash (null)', so(team(5, (i) => (i < 2 ? { tone: 'Flat' } : i < 4 ? { tone: 'Animated' } : { tone: 'Even' }))) === null)
  ok('a pattern that stands out comes before Even', so(team(8, (i) => (i < 3 ? { tone: 'Flat' } : {})))?.key === 'flatTense')
}

// ── moments to watch ──
{
  const reads = sp.readPeople([
    ...team(8, (i) => ({ at: 50 + i, facts: { delaySec: 1 + i * 0.4, pauseSec: i * 0.3, fillers: i % 3 }, band: i > 5 ? 'Marked hesitation' : 'Steady' })),
    pt(1, { at: 999, tone: 'Flat', facts: { delaySec: 1, pauseSec: 0, fillers: 0 } }),
  ])
  const list = sp.momentsToWatch(reads, 5)
  ok('at most the requested number of clips', list.length === 5 && sp.momentsToWatch(reads, 3).length === 3)
  ok('one clip per person', new Set(list.map((x) => x.participantId)).size === list.length)
  ok('the first is the clearest (highest score), then in order', list.every((x, i) => i === 0 || list[i - 1].score >= x.score))
  ok('each clip carries the measured reason in numbers', list.every((x) => /^Answered \d+\.\d s after the question\. Usual: \d+\.\d s\./.test(x.reason)), list.map((x) => x.reason))
  const one = sp.readPeople([pt(1, { at: 10, tone: 'Flat', pace: 80, pitch: 3 }), pt(1, { at: 20, facts: { delaySec: 1, pauseSec: 0, fillers: 0 } })])
  ok('a person with two quotes gives the one that is furthest from their baseline and contradicts their words', sp.momentsToWatch(one, 5)[0].atSec === 10 && sp.momentsToWatch(one, 5).length === 1)
  ok('contradicting the words scores higher than the same distance without', sp.momentScore(pt(1), true) > sp.momentScore(pt(1), false))
  ok('the reason names the tone when it is not even', /Sounded flat: \d+ words a minute\. Usual: \d+\./.test(sp.measuredReason(pt(1, { tone: 'Flat' }))))
}

// ── the real studies ──
const studies = ['pet-food-churn', 'ice-cream-flavours']
const docOf = (id) => {
  const people = ms.acceptedParticipants(id)
  const doc = cb.seedCodebook(id, people.map(ms.sessionOfParticipant))
  const basis = cb.basisOf(people.map((p) => ({ id: ms.sessionOfParticipant(p), participantId: p })))
  return { doc, basis }
}
for (const id of studies) {
  const { doc, basis } = docOf(id)
  const codes = sg.codeSignals(doc, basis)
  const themes = sg.themeSignals(doc, basis, codes)
  ok(`${id}: every theme and code has one reading per person`, themes.every((t) => t.reads.length === t.people && new Set(t.reads.map((r) => r.participantId)).size === t.reads.length) && codes.every((c) => c.reads.length === c.people))
  ok(`${id}: a verdict never depends on a face reading`, (() => {
    const strip = (d) => d
    const faceless = codes.map((c) => sp.fitSplit(c.positions.map((p) => ({ ...p, face: undefined })), doc).pattern)
    return codes.every((c, i) => c.fit.pattern === faceless[i])
  })())
  ok(`${id}: row and tiles agree (matched + no match + hesitant + split = people with a position)`, themes.every((t) => t.fit.fits + t.fit.uncertain + t.fit.against + t.fit.split === t.fit.n && t.reads.filter((r) => r.fit).length === t.fit.n))
  const real = themes.filter((t) => t.kind !== 'none' && t.insight)
  ok(`${id}: every theme insight passes the validator`, real.every((t) => nr.checkNarration(t.insight.sentence).ok), real.map((t) => nr.checkNarration(t.insight.sentence).problems))
  ok(`${id}: the insight and the row use the same N (everyone who raised the theme)`, real.every((t) => t.insight.of === t.people))
  ok(`${id}: moments are one per person with a measured reason`, themes.every((t) => t.moments.length <= 5 && new Set(t.moments.map((x) => x.participantId)).size === t.moments.length && t.moments.every((x) => x.reason.startsWith('Answered '))))
  ok(`${id}: a code’s “What stood out” is a dash or has at least three people`, codes.every((c) => !c.standout || c.standout.n >= 3))
}

// ── corrections, decisions, Out of date (on the Ice Cream seed) ──
{
  const id = 'ice-cream-flavours'
  const { doc, basis } = docOf(id)
  const who = { by: 'Maya Ortiz' }
  const theme = (d) => sg.themeSignals(d, basis, sg.codeSignals(d, basis)).find((t) => t.id === 't-family')
  const t0 = theme(doc)
  const cur = (t) => ({ text: t.now.text, fingerprint: t.now.fingerprint, snap: t.now.snap })
  ok('before any decision, the insight is Suggested', t0.decision.status === 'Suggested')

  const accepted = cb.acceptInsight(doc, t0, cur(t0), who)
  const d1 = accepted.insights['t-family']
  ok('accepting records who, when, the data fingerprint and the data version', d1.status === 'Accepted' && d1.by === 'Maya Ortiz' && !!d1.at && d1.fingerprint === t0.now.fingerprint && d1.dataVersion === 1 && d1.text === t0.insight.sentence)
  ok('accepting is in the log', accepted.log[0].action.startsWith('Insight accepted') && accepted.log[0].target.id === 't-family')
  ok('an accepted insight is current while nothing changed', theme(accepted).decision.status === 'Accepted')

  ok('an edit may not change the numbers', sp.checkInsightEdit(t0.insight.sentence.replace('7 of 9', '8 of 9'), t0.insight.sentence).some((p) => /numbers are locked/i.test(p)))
  ok('an edit may not use a percentage', sp.checkInsightEdit('7 of 9 people (78%) were verbally positive about it.', t0.insight.sentence).length > 0)
  const wording = t0.insight.sentence.replace('were verbally positive about it', 'said good things about it')
  ok('an edit that only changes the wording passes', sp.checkInsightEdit(wording, t0.insight.sentence).length === 0, sp.checkInsightEdit(wording, t0.insight.sentence))
  const edited = cb.editInsight(accepted, t0, cur(t0), wording, who)
  ok('an edit is recorded as Edited, keeps the AI’s sentence beside it, and stays current', edited.insights['t-family'].status === 'Edited' && edited.insights['t-family'].original === t0.insight.sentence && theme(edited).decision.status === 'Edited')
  ok('editing only the wording does not change the fingerprint', edited.insights['t-family'].fingerprint === d1.fingerprint)

  const left = cb.leaveOutInsight(doc, t0, cur(t0), who, '  Not relevant to the brief  ')
  ok('leave out records an optional reason, trimmed', left.insights['t-family'].status === 'Left out' && left.insights['t-family'].why === 'Not relevant to the brief' && cb.leaveOutInsight(doc, t0, cur(t0), who).insights['t-family'].why === undefined)
  ok('a left-out insight stays left out when the data changes', theme(cb.correctCodeStance(left, doc.codes.find((c) => c.id === 'ic-pick-cookie'), 'Positive', 'Negative', who)).decision.status === 'Left out')
  ok('restoring puts it back to Suggested', theme(cb.restoreInsight(left, t0, who)).decision.status === 'Suggested')

  // A correction changes the data, so an accepted insight goes Out of date and shows old and new.
  const code = doc.codes.find((c) => c.id === 'ic-pick-cookie')
  const fixed = cb.correctCodeStance(accepted, code, 'Positive', 'Negative', who, 'They described a worry, not a wish')
  const t1 = theme(fixed)
  ok('correcting a code’s stance updates the counts', t1.insight.sentence !== t0.insight.sentence && t1.fit.n === t0.fit.n && (t1.fit.against !== t0.fit.against || t1.stances.Negative !== t0.stances.Negative), [t0.insight.sentence, t1.insight.sentence])
  ok('the correction is logged with who, from and to', fixed.log[0].action === 'Stance corrected' && /From “For it” to “Against it”/.test(fixed.log[0].detail) && fixed.log[0].by === 'Maya Ortiz' && fixed.log[0].why === 'They described a worry, not a wish')
  ok('an accepted insight goes Out of date, showing old and new', t1.decision.status === 'Out of date' && t1.decision.was?.text === t0.insight.sentence && t1.decision.now?.text === t1.insight.sentence, t1.decision)
  ok('choosing the AI’s own stance again removes the correction', (() => { const back = cb.correctCodeStance(fixed, code, 'Positive', 'Positive', who); return !back.stanceFixes?.['code:ic-pick-cookie'] && theme(back).decision.status === 'Accepted' })())
  ok('a correction to the same stance changes nothing and logs nothing', cb.correctCodeStance(doc, code, 'Positive', 'Positive', who) === doc)

  const person = code.excerpts.map((e) => cb.excerpt(e).participantId)[0]
  const pfix = cb.correctPersonStance(doc, code, person, 'Positive', 'Negative', who, 'Said it as a complaint')
  const t2 = theme(pfix)
  const readOf = (t, p) => t.reads.find((r) => r.participantId === p)
  ok('a per-person correction changes that person only', readOf(t2, person).side === 'Negative' && t2.reads.filter((r) => r.participantId !== person).every((r) => r.side === readOf(t0, r.participantId).side))
  ok('a per-person correction is logged', pfix.log[0].action === 'Person’s stance corrected' && pfix.log[0].target.kind === 'reading')
  ok('a person’s own correction wins over the code’s', (() => { const both = cb.correctPersonStance(cb.correctCodeStance(doc, code, 'Positive', 'Negative', who), code, person, 'Negative', 'Positive', who); return readOf(theme(both), person).side === 'Positive' })())

  // Data version: only a change to the data bumps it, never a decision on an insight.
  cb.resetCodebook()
  cb.ensureCodebook(id, ms.acceptedParticipants(id).map(ms.sessionOfParticipant))
  const version = () => cb.dataVersionOf(cb.getCodebook(id))
  ok('a new codebook is data version 1', version() === 1)
  cb.updateCodebook(id, (d) => cb.acceptInsight(d, t0, cur(t0), who))
  ok('deciding on an insight does not change the data version', version() === 1)
  cb.updateCodebook(id, (d) => cb.correctCodeStance(d, code, 'Positive', 'Negative', who))
  ok('correcting a stance does', version() === 2)
  cb.updateCodebook(id, (d) => cb.acceptInsight(d, t0, cur(t0), who))
  const stored = cb.getCodebook(id).insights['t-family']
  ok('a decision records the version it was made on', stored.dataVersion === 2)
  cb.resetCodebook()
}

// ── too few people: Nothing to decide ──
{
  const id = 'pet-food-churn'
  const { doc, basis } = docOf(id)
  const who = { by: 'Maya Ortiz' }
  const tooFew = doc.codes.find((c) => c.id === 'c-nothing')
  const made = cb.createTheme(doc, 'Nothing would have kept them', 'Nobody could have kept them.', [tooFew.id], who)
  const themeId = made.themes[made.themes.length - 1].id
  const get = (d) => sg.themeSignals(d, basis, sg.codeSignals(d, basis)).find((t) => t.id === themeId)
  const t = get(made)
  const cur = { text: t.now.text, fingerprint: t.now.fingerprint, snap: t.now.snap }
  ok('under three people: no insight, status Nothing to decide, not decidable', t.people < 3 && t.insight === null && t.decidable === false && t.decision.status === 'Nothing to decide' && t.verdict === 'Too few to read', [t.people, t.decision.status])
  ok('Accept and Edit do nothing for it', cb.acceptInsight(made, t, cur, who) === made && cb.editInsight(made, t, cur, 'Anything', who) === made)
  ok('it can still be left out, but only with a reason', cb.leaveOutInsight(made, t, cur, who) === made && cb.leaveOutInsight(made, t, cur, who, '   ') === made)
  const left = cb.leaveOutInsight(made, t, cur, who, 'Only two people, and not the brief')
  ok('left out with a reason, it is Left out and the reason is kept', get(left).decision.status === 'Left out' && left.insights[themeId].why === 'Only two people, and not the brief')
  ok('the tip is “Too few people to read a pattern”', sp.TOO_FEW_TIP === 'Too few people to read a pattern')
  const before = sg.insightCounts(sg.themeSignals(doc, basis, sg.codeSignals(doc, basis)))
  const after = sg.insightCounts(sg.themeSignals(made, basis, sg.codeSignals(made, basis)))
  ok('it is not in the progress counts or Review mode', after.total === before.total && after.toReview.length === before.toReview.length && !after.toReview.some((x) => x.id === themeId) && after.nothingToDecide === before.nothingToDecide + 1, [before.total, after.total])
  ok('a code with too few people is not decidable either', sg.codeSignals(doc, basis).find((c) => c.code.id === 'c-nothing').decidable === false)
}

// ── Not in a theme: numbers kept, nothing shown ──
for (const id of studies) {
  const { doc, basis } = docOf(id)
  const themes = sg.themeSignals(doc, basis, sg.codeSignals(doc, basis))
  const none = themes.find((t) => t.kind === 'none')
  ok(`${id}: Not in a theme still has its numbers (people, fit and verdict are computed for the Theme map)`, !!none && none.people > 0 && none.fit.n > 0 && !!none.verdict)
  ok(`${id}: it has no insight, no moments, and nothing to decide or accept`, none.insight === null && none.moments.length === 0 && none.decidable === false)
  const counts = sg.insightCounts(themes)
  ok(`${id}: it is not in the progress counts or Review mode`, !counts.toReview.some((t) => t.id === 'none') && counts.total === themes.filter((t) => t.kind === 'theme' && t.decidable).length)
}

// ── report ticks are never read for insights ──
{
  const { doc, basis } = docOf('pet-food-churn')
  const a = sg.themeSignals(doc, basis).map((t) => t.decision.status)
  const withTicks = { ...doc, themePicks: { 't-price': true, 't-pet': true }, signalPicks: { 'c-runout': true } }
  const b = sg.themeSignals(withTicks, basis).map((t) => t.decision.status)
  ok('an old per-theme or per-code tick does not make an insight accepted or change any status', JSON.stringify(a) === JSON.stringify(b) && b.every((x) => x !== 'Accepted' && x !== 'Edited'), [a, b])
}

await vite.close()
if (failures.length) {
  console.log(`${n} checks, ${failures.length} failed\nA2 VERDICT FAILED:\n - ${failures.join('\n - ')}`)
  process.exit(1)
}
console.log(`${n} checks, 0 failed\nA2 VERDICT OK`)
