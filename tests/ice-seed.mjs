// The Ice Cream seed against its design data (docs/stitch/ICE_CREAM_MOCK_DATA.md). The expected values are read out of that file's own
// tables, not out of the seed, so the two cannot drift together. Runs the real modules through Vite's SSR loader:   node tests/ice-seed.mjs
// The file and the seed agree everywhere: where the real logic could not give a number the file was first changed to what the seed does (docs/OPEN_QUESTIONS.md #279 to #288).
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' })
const m = (p) => vite.ssrLoadModule(p)
const cb = await m('/src/state/codebook.ts'), ms = await m('/src/mock/signals.ts'), sg = await m('/src/state/signals.ts'), cn = await m('/src/state/concepts.ts')
const mc = await m('/src/mock/concepts.ts'), em = await m('/src/mock/emotion.ts'), dl = await m('/src/config/delivery.ts'), sa = await m('/src/mock/studyAnalysis.ts'), sp = await m('/src/state/speech.ts')
const sess = await m('/src/mock/sessions.ts'), sv = await m('/src/mock/surveys.ts')

const failures = []
let n = 0
const ok = (label, cond, detail) => { n++; if (!cond) failures.push(detail === undefined ? label : `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})`) }

// ── read the design data ──
const md = readFileSync('docs/stitch/ICE_CREAM_MOCK_DATA.md', 'utf8')
const tableAfter = (marker) => {
  const lines = md.slice(md.indexOf(marker)).split('\n')
  const start = lines.findIndex((l) => l.startsWith('|'))
  const out = []
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) out.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()))
  return out
}
const SHORT = { Caramel: 'm-concept-a', Mango: 'm-concept-b', Cookie: 'm-concept-c' }
const [A, B, C] = ['m-concept-a', 'm-concept-b', 'm-concept-c']
const people = tableAfter('**The people.**').map(([id, seg, media, said, warm, did, locked]) => ({ id, seg: seg === 'Parent' ? 'Parent' : 'Adult', video: media === 'Video', said: SHORT[said], warm: SHORT[warm], did: SHORT[did], locked }))
ok('the design data names 20 people, P-4101 to P-4120', people.length === 20 && people.every((p, i) => p.id === `P-${4101 + i}`))

// ── who is in the study ──
const study = 'ice-cream-flavours'
const ppl = ms.acceptedParticipants(study)
ok('the 20 accepted participants are P-4101 to P-4120', JSON.stringify(ppl) === JSON.stringify(people.map((p) => p.id)), ppl)
ok('segments: 8 parents and 12 adults without children, each person where the file puts them', people.every((p) => sa.segmentOf(p.id) === p.seg) && people.filter((p) => p.seg === 'Parent').length === 8)
ok('15 are on video (P-4101 to P-4115) and 5 are audio-only (P-4116 to P-4120)', people.every((p) => em.hasVideo(p.id) === p.video) && people.filter((p) => !p.video).map((p) => p.id).join() === 'P-4116,P-4117,P-4118,P-4119,P-4120')
const seeds = sess.STUDY_SEEDS[study]
const done = seeds.filter((s) => s.variant === 'done')
ok('22 interviews done: 20 accepted, 2 excluded (P-4121, P-4122), no one lost a concept card', done.length === 22 && done.filter((s) => s.review.status === 'Excluded').map((s) => s.participant).join() === 'P-4121,P-4122' && !done.some((s) => (s.issues ?? []).some((i) => /Stimulus failed/.test(i[0]))))

// ── the choice task, the locked answers, the first reactions ──
const rosterSaid = (c) => people.filter((p) => p.said === c).length
const rosterDid = (c) => people.filter((p) => p.did === c).length
const rosterWarm = (c) => people.filter((p) => p.warm === c).length
ok('the file’s totals: Said 8, 5, 7; Did 10, 3, 7; Warmest 1, 9, 5', [A, B, C].map(rosterSaid).join() === '8,5,7' && [A, B, C].map(rosterDid).join() === '10,3,7' && [A, B, C].map(rosterWarm).join() === '1,9,5')
const picks = mc.conceptStudyOf(study).choice.picks
ok('the choice task is each person’s pick from the file', people.every((p) => picks[p.id] === p.did))
const cookie = people.filter((p) => p.said === C)
const locked = (id) => sv.surveyAnswerFor(id, 'Flavour reaction', { id: 'q1', type: 'choice', text: 'How likely are you to buy it?' })
const lockedKind = (p) => (p.locked === 'no answer' ? 'none' : p.locked === 'Probably would not' ? 'no' : 'yes')
const gotKind = (id) => { const a = locked(id); return !a ? 'none' : /not/i.test(a) ? 'no' : 'yes' }
ok('locked answers (Cookie first only): 3 would, 3 probably would not, 1 gave none (P-4120)', cookie.length === 7 && cookie.every((p) => gotKind(p.id) === lockedKind(p)) && cookie.filter((p) => lockedKind(p) === 'yes').length === 3 && cookie.filter((p) => lockedKind(p) === 'no').length === 3 && cookie.filter((p) => lockedKind(p) === 'none').map((p) => p.id).join() === 'P-4120')

const basisOf = () => ({ doc: cb.seedCodebook(study, ppl.map(ms.sessionOfParticipant)), basis: cb.basisOf(ppl.map((p) => ({ id: ms.sessionOfParticipant(p), participantId: p }))) })
const { doc, basis } = basisOf()
const cr = cn.conceptRows(doc, basis)
const fig = (r) => [r.said, r.did, r.showed].map((x) => `${x.n}/${x.of}`).join(' ')
ok('Concepts: Said 8/5/7 of 20, Did 10/3/7 of 20, Showed 1/9/5 of 15; Caramel Differs, Mango Differs, Cookie Agrees', cr.rows.map(fig).join(' | ') === '8/20 10/20 1/15 | 5/20 3/20 9/15 | 7/20 7/20 5/15' && cr.rows.map((r) => r.match).join() === 'Differs,Differs,Agrees', cr.rows.map(fig))
ok('Concepts: coverage 15 read, 5 audio-only, none without consent', cr.coverage.read === 15 && cr.coverage.audioOnly === 5 && cr.coverage.noConsent === 0)
const differ = people.filter((p) => new Set([p.said, p.did, ...(p.video ? [p.warm] : [])]).size > 1).length
ok('10 of 20 people differ across Said, Did and Showed', differ === 10, differ)
ok('the first reaction of each person on video is Delight at the concept the file names, and no other concept reads warmer', people.filter((p) => p.video).every((p) => [A, B, C].every((c) => { const r = mc.revealReading(study, p.id, c); return c === p.warm ? r?.label === 'Delight' : !!r && r.label !== 'Delight' })))
const lines = cr.rows.map((r) => r.line)
ok('the three concept lines are the file’s', lines.join(' // ') === [
  '10 of 20 chose Salted Caramel Swirl to take home, but it drew the warmest first reaction for only 1 of 15 on video.',
  'Mango Lassi drew the warmest first reaction for 9 of 15 on video, but only 3 of 20 chose it to take home.',
  'Cookie Dough Crunch drew the warmest first reaction for 5 of 15 on video, and 7 of 20 chose it to take home.'].join(' // '), lines)

// ── themes and codes, against the file's tables ──
const VL = dl.VERDICT_LABEL
const tens = sg.tensionsOf(doc, basis)
const themes = sg.themeSignals(doc, basis, sg.codeSignals(doc, basis))
const themeRows = tableAfter('### 1.1 The table').map(([name, codes, said, , verdict, , insight]) => ({ name, codes: Number(codes.split(' ')[0]), said: said === '—' ? null : Number(said.split(' ')[0]), verdict, insight }))
for (const row of themeRows) {
  const t = themes.find((x) => x.name === row.name)
  if (!t) { ok(`theme “${row.name}” exists`, false); continue }
  if (row.name === 'Not in a theme') { ok(`Not in a theme: ${row.codes} codes, no verdict, no insight`, t.codes.length === row.codes && !t.insight); continue }
  ok(`${row.name}: ${row.codes} codes, said by ${row.said} of 20, verdict ${row.verdict}, and the file’s insight line`, t.codes.length === row.codes && t.people === row.said && VL[t.fit.pattern] === row.verdict && t.insight.sentence === row.insight, [t.codes.length, t.people, VL[t.fit.pattern], t.insight?.sentence])
}
// The moments each theme panel shows (who, when, what they said, the result, the reason) are the real ones.
{
  const mmss = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(Math.round(x % 60)).padStart(2, '0')}`
  for (const t of themes.filter((x) => x.kind === 'theme')) {
    const block = md.slice(md.indexOf(`#### ${t.name}\n`))
    const lines = block.slice(block.indexOf('| ID | Segment | Time')).split('\n').slice(2)
    const docRows = []
    for (const l of lines) { if (!l.startsWith('|')) break; docRows.push(l.split('|').slice(1, -1).map((c) => c.trim())) }
    const real = sp.momentsToWatch(t.reads, 5).map((x) => [x.participantId, mmss(x.atSec), `“${x.quote}”`, x.reason || '(no reason line: nothing crossed a limit)'])
    ok(`${t.name}: the five moments to watch are the file’s (who, time, words, reason)`, docRows.length === 5 && docRows.every((r, i) => r[0] === real[i][0] && r[2] === real[i][1] && r[3] === real[i][2] && r[5] === real[i][3]), docRows.map((r) => r[0]))
  }
}
const codeExpectations = []
for (const marker of ['**Codes in “The safe choice wins the shelf”**', '**Codes in “Parents choose for the whole family”**', '**Codes in “Curious about something different”**', '**Codes in “Not in a theme”**']) tableAfter(marker).forEach(([name, stance, said, standout, verdict, status]) => codeExpectations.push({ name, stance, said: Number(said.split(' ')[0]), standout, verdict, status }))
const STANCE_WORD = { Positive: 'For it', Negative: 'Against it', Neutral: 'Just describes' }
const allCodes = themes.flatMap((t) => t.codes)
for (const e of codeExpectations) {
  const c = allCodes.find((x) => x.code.name === e.name)
  if (!c) { ok(`code “${e.name}” exists`, false); continue }
  const verdict = c.reads.length < 3 ? 'Too few to read' : VL[c.fit.pattern]
  const stood = c.standout ? sp.standoutLabel(c.standout) : '—'
  const same = c.people === e.said && stood === e.standout
  ok(`code ${e.name}: ${e.said} of 20, ${e.standout}, ${e.verdict}, ${e.stance}`, same && verdict === e.verdict && STANCE_WORD[sp.codeStance(doc, c.code.id)] === e.stance, [c.people, stood, verdict])
}
ok('the accepted codes are the 16 the file lists plus “Would buy Mango Lassi first” (in the file’s Not in a theme table), and nothing else', doc.codes.filter((c) => c.status === 'Accepted').length === 17 && doc.codes.filter((c) => c.status === 'Accepted').every((c) => allCodes.some((x) => x.code.id === c.id)))
ok('the seed holds no stance corrections: P-4120 is in “Would buy Cookie Dough Crunch first” as For it, so the code has the 7 who said Cookie first', !doc.stanceFixes && !doc.log.some((l) => /stance corrected/i.test(l.action)) && allCodes.find((c) => c.code.id === 'ic-pick-cookie').people === 7 && allCodes.find((c) => c.code.id === 'ic-pick-cookie').reads.find((r) => r.participantId === 'P-4120').fit === 'Matches')

{
  const fam = themes.find((t) => t.name === 'Parents choose for the whole family')
  const g = sg.sideSummary(fam.reads).groups, fit = (side, k) => fam.reads.filter((r) => r.side === side && r.fit === k).length
  ok('Parents choose for the whole family: Said by 10; For it 8 (4 matched, 3 no match, 1 hesitant), Against it 2 (1, 1, 0); Mixed, 4 of 8 matched on the for side', fam.people === 10 && g.find((x) => x.side === 'Positive').points.length === 8 && [fit('Positive', 'Matches'), fit('Positive', 'Pulls against'), fit('Positive', 'Uncertain')].join() === '4,3,1' && g.find((x) => x.side === 'Negative').points.length === 2 && [fit('Negative', 'Matches'), fit('Negative', 'Pulls against'), fit('Negative', 'Uncertain')].join() === '1,1,0' && VL[fam.fit.pattern] === 'Mixed' && fam.insight.sentence === '8 of 10 people were verbally positive about it, but 3 of those 8 sounded flat or tense.')
  // a theme row’s tension count and its panel list are the same list: both are the tensions on its codes that are not waiting
  const rowCount = (t) => tens.filter((x) => !x.unavailable && x.codeIds.some((id) => t.codes.some((c) => c.code.id === id))).length
  ok('tensions link by code: Safe 1 (the Said vs showed card), Parents 2 (Between segments, Said vs locked answer), Curious 0', ['The safe choice wins the shelf', 'Parents choose for the whole family', 'Curious about something different'].map((n) => rowCount(themes.find((t) => t.name === n))).join() === '1,2,0')
}

// ── the tension bases, each worked out from the people table and then read off the cards ──
const said = (c) => people.filter((p) => p.said === c)
const byId = (id) => tens.find((t) => t.id === id)
{
  // Said vs locked answer: 7 of 20; 3 would, 3 probably would not, 1 none
  const t = byId('tn-cookie-locked')
  ok('Said vs locked answer: 7 of 20 said Cookie first; 3 of 7 then said they probably wouldn’t buy it, 3 answered positively, 1 gave no answer', said(C).length === 7 && t.sides[0].n === 7 && t.sides[0].of === 20 && t.sides[1].n === 3 && t.sides[1].of === 7 && t.sides[1].rest.map((r) => `${r.label}:${r.n}`).join() === 'Answered positively:3,No clear survey answer:1', JSON.stringify(t.sides))
  ok('…and it is Added as a tension theme, by the Researcher, with its own theme', t.status === 'Added as a tension theme' && doc.themes.some((x) => x.tensionId === 'tn-cookie-locked') && t.decision.by)
}
{
  // Said vs did: 5 of 20 said Mango first; of those 2 chose Mango, 2 Caramel, 1 Cookie
  const mango = said(B)
  const t = byId('tn-mango-did')
  const chose = (c) => mango.filter((p) => p.did === c).length
  ok('Said vs did: 5 of 20 said Mango first; 2 chose Mango, 2 Caramel, 1 Cookie, none unaccounted', mango.length === 5 && [B, A, C].map(chose).join() === '2,2,1' && t.sides[0].n === 5 && t.sides[0].of === 20 && t.sides[1].n === 2 && t.sides[1].rest.map((r) => `${r.n}`).join() === '2,1', JSON.stringify(t.sides))
}
{
  // Said vs showed: 8 of 20 said Caramel first; 6 on video, 2 audio-only (P-4116, P-4117); of the 6 warmest at Caramel 1, Mango 4, Cookie 1
  const car = said(A), vid = car.filter((p) => p.video)
  ok('Said vs showed (from the file): 8 of 20; 6 on video, 2 audio-only not read; warmest at Caramel 1, Mango 4, Cookie 1', car.length === 8 && vid.length === 6 && car.filter((p) => !p.video).map((p) => p.id).join() === 'P-4116,P-4117' && [A, B, C].map((c) => vid.filter((p) => p.warm === c).length).join() === '1,4,1')
  ok('…and the card’s base is the same 8 of 20 (its warmest-at-another-concept rows are rebuilt in phase 4)', byId('tn-caramel-mango-face').sides[0].n + 2 === 8)
}
{
  const t = byId('tn-segments'), parents = people.filter((p) => p.seg === 'Parent'), adults = people.filter((p) => p.seg !== 'Parent')
  const g = (list, c) => list.filter((p) => p.said === c).length
  ok('Between segments: base 20 (8 parents, 12 adults). Parents 5 Cookie, 1 Mango; adults 2 Cookie, 4 Mango (and 2 Caramel, 6 Caramel in the file)', parents.length + adults.length === 20 && [g(parents, C), g(parents, B), g(adults, C), g(adults, B)].join() === '5,1,2,4' && [g(parents, A), g(adults, A)].join() === '2,6' && t.sides.map((s) => s.n).join() === '5,1,2,4' && t.sides.map((s) => s.of).join() === '8,8,12,12', JSON.stringify(t.sides.map((s) => [s.n, s.of])))
}
const counts = sg.tensionCounts(doc)
ok('Tensions: To review 3, Added 1, Dismissed 0, Waiting 1, All 5; the waiting card is in none of the other counts', counts.toReview === 3 && counts.themes === 1 && counts.dismissed === 0 && counts.waiting === 1 && counts.total + counts.waiting === 5, counts)
ok('the waiting card is the price one, locked until “A high price would stop them” is accepted', byId('tn-price-survey').unavailable?.includes('A high price would stop them') && byId('tn-price-survey').sides.length === 0)
ok('every card’s base is who said it: Said first 8, 7, 5, 8 of 20', [['tn-caramel-mango-face', 8], ['tn-cookie-locked', 7], ['tn-mango-did', 5]].every(([id, base]) => said({ 'tn-caramel-mango-face': A, 'tn-cookie-locked': C, 'tn-mango-did': B }[id]).length === base))

// ── Pet Food is untouched ──
{
  const pp = ms.acceptedParticipants('pet-food-churn')
  const pdoc = cb.seedCodebook('pet-food-churn', pp.map(ms.sessionOfParticipant))
  const pb = cb.basisOf(pp.map((p) => ({ id: ms.sessionOfParticipant(p), participantId: p })))
  ok('Pet Food: 20 accepted, 4 audio-only (P-3105, 3110, 3113, 3118), 12 of 31 codes accepted, tensions 3 to review, 1 added, 1 dismissed, none waiting', pp.length === 20 && pp.filter((p) => !em.hasVideo(p)).join() === 'P-3105,P-3110,P-3113,P-3118' && pdoc.codes.filter((c) => c.status === 'Accepted').length === 12 && pdoc.codes.length === 31 && JSON.stringify(sg.tensionCounts(pdoc)) === '{"total":5,"waiting":0,"toReview":3,"themes":1,"dismissed":1}')
  const pc = cn.conceptRows(pdoc, pb)
  ok('Pet Food: no choice task, so no Did column; P-3106 never saw Concept B and P-3114 did not consent', pc && !pc.hasChoiceTask && pc.rows.every((r) => r.did === undefined) && !mc.revealReading('pet-food-churn', 'P-3106', B) && !mc.revealReading('pet-food-churn', 'P-3114', A))
}

await vite.close()
if (failures.length) { console.error(`${n} checks, ${failures.length} failed\nICE SEED FAILED:\n - ${failures.join('\n - ')}`); process.exit(1) }
console.log(`${n} checks, 0 failed\nICE SEED OK`)
