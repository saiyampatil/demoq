// A2 Tensions, the logic: the four kinds in their order, every card adding up to its base, the Waiting card out of every count,
// Directional under 10 people, what each card affects, and a tension added as a theme making the insights it touches Out of date.
// Runs the real modules through Vite's SSR loader:   node tests/a2-tensions.mjs
import { createServer } from 'vite'

const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' })
const m = (p) => vite.ssrLoadModule(p)
const cb = await m('/src/state/codebook.ts'), ms = await m('/src/mock/signals.ts'), sg = await m('/src/state/signals.ts'), cn = await m('/src/state/concepts.ts')
const failures = []
let n = 0
const ok = (label, cond, detail) => { n++; if (!cond) failures.push(detail === undefined ? label : `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})`) }

const docOf = (study) => {
  const ppl = ms.acceptedParticipants(study)
  const doc = cb.seedCodebook(study, ppl.map(ms.sessionOfParticipant))
  return { doc, basis: cb.basisOf(ppl.map((p) => ({ id: ms.sessionOfParticipant(p), participantId: p }))) }
}
for (const study of ['ice-cream-flavours', 'pet-food-churn']) {
  const { doc, basis } = docOf(study)
  const ts = sg.tensionsOf(doc, basis)
  ok(`${study}: only the four kinds, in the fixed order`, JSON.stringify(sg.TENSION_KINDS) === JSON.stringify(['Between segments', 'Said vs locked answer', 'Said vs did', 'Said vs showed']) && ts.every((t) => sg.TENSION_KINDS.includes(t.kind)))
  for (const t of ts.filter((x) => !x.unavailable)) {
    const inRows = t.rows.reduce((a, r) => a + r.n, 0)
    ok(`${study} ${t.id}: rows plus unaccounted equal the base (${t.base})`, inRows + (t.unaccounted?.n ?? 0) === t.base, [inRows, t.unaccounted?.n, t.base])
    ok(`${study} ${t.id}: the accounting line says so`, new RegExp(`of ${t.base} people accounted for`).test(t.accounting), t.accounting)
    ok(`${study} ${t.id}: Directional exactly when a base or group is under 10`, t.directional === (t.kind === 'Between segments' ? Math.min(...t.sides.map((s) => s.of)) < 10 : t.base < 10), [t.directional, t.base])
  }
  const c = sg.tensionCounts(doc)
  const waiting = ts.filter((t) => t.unavailable && !t.decision)
  ok(`${study}: a waiting card is in no count (to review, themes, dismissed) and its own segment holds it`, c.waiting === waiting.length && c.toReview === ts.filter((t) => t.status === 'Suggested' && !t.unavailable).length && c.total + c.waiting === ts.length, c)
}

// ── Ice Cream numbers, from the design data ──
{
  const { doc, basis } = docOf('ice-cream-flavours')
  const ts = sg.tensionsOf(doc, basis)
  const by = (id) => ts.find((t) => t.id === id)
  const showed = by('tn-caramel-mango-face')
  const lab = (re) => showed.rows.find((r) => re.test(r.label))
  ok('Said vs showed: 8 said Caramel first; 6 on video: Caramel 1 (P-4108), Mango 4 (P-4101, P-4104, P-4106, P-4107), Cookie 1 (P-4115); 2 audio-only not read (P-4116, P-4117)', showed.base === 8 && lab(/Concept A/).who.join() === 'P-4108' && lab(/Concept B/).who.join() === 'P-4101,P-4104,P-4106,P-4107' && lab(/Concept C/).who.join() === 'P-4115' && showed.unaccounted.who.join() === 'P-4116,P-4117', showed.rows.map((r) => [r.label, r.who]))
  ok('Said vs locked answer: 7 of 20, 3 would not, 3 would, 1 no answer', by('tn-cookie-locked').base === 7 && by('tn-cookie-locked').rows.map((r) => r.n).join() === '3,3' && by('tn-cookie-locked').unaccounted.n === 1)
  ok('Said vs did: 5 of 20, 2 chose Mango, 2 Caramel, 1 Cookie', by('tn-mango-did').base === 5 && by('tn-mango-did').rows.map((r) => r.n).join() === '2,2,1')
  ok('Between segments: base 20', by('tn-segments').base === 20)
  ok('every card says what it affects: Between segments the Parents theme, the others a concept', by('tn-segments').affects?.name === 'Parents choose for the whole family' && by('tn-cookie-locked').affects?.kind === 'concept' && by('tn-mango-did').affects?.name === 'Concept B: Mango Lassi' && by('tn-caramel-mango-face').affects?.name === 'Concept A: Salted Caramel Swirl')
  ok('the waiting card is locked, affects nothing yet, and has no rows', by('tn-price-survey').unavailable && !by('tn-price-survey').affects && by('tn-price-survey').rows.length === 0)

  // ── add as a tension theme: the insights it touches are Out of date ──
  const who = { by: 'Maya Ortiz' }
  const themeNow = (d) => sg.themeSignals(d, basis, sg.codeSignals(d, basis))
  const concept = (d, id) => cn.conceptRows(d, basis).rows.find((r) => r.id === id)
  // accept the Parents theme, the Cookie concept line and the Mango concept line, then add the Between segments tension
  let d = doc
  const fam = themeNow(d).find((t) => t.id === 't-family')
  d = cb.acceptInsight(d, { id: fam.id, name: fam.name }, fam.now, who)
  const cookie = concept(d, 'm-concept-c'), mango = concept(d, 'm-concept-b')
  d = cb.acceptInsight(d, { id: cookie.key, name: cookie.name }, cookie.now, who)
  d = cb.acceptInsight(d, { id: mango.key, name: mango.name }, mango.now, who)
  ok('before: all three are Accepted', themeNow(d).find((t) => t.id === 't-family').decision.status === 'Accepted' && concept(d, 'm-concept-c').decision.status === 'Accepted' && concept(d, 'm-concept-b').decision.status === 'Accepted')
  const seg = sg.tensionsOf(d, basis).find((t) => t.id === 'tn-segments')
  d = cb.turnTensionIntoTheme(d, seg, seg.codeIds, seg.themeName, seg.summary, who)
  ok('after adding Between segments as a theme: the Parents theme and the Cookie and Mango lines are Out of date (they draw on its codes)', themeNow(d).find((t) => t.id === 't-family').decision.status === 'Out of date' && concept(d, 'm-concept-c').decision.status === 'Out of date' && concept(d, 'm-concept-b').decision.status === 'Out of date')
  ok('…and the Caramel line, which does not draw on them, is untouched', concept(d, 'm-concept-a').decision.status === 'Suggested')
  ok('the new theme is tagged as from a tension and has no insight to decide', d.themes.some((t) => t.tensionId === 'tn-segments') && themeNow(d).find((t) => t.kind === 'tension' && t.theme.tensionId === 'tn-segments'))
  d = cb.restoreTension(d, seg, who)
  ok('restoring it takes the theme out and the insights are current again', !d.themes.some((t) => t.tensionId === 'tn-segments') && themeNow(d).find((t) => t.id === 't-family').decision.status === 'Accepted' && concept(d, 'm-concept-c').decision.status === 'Accepted')
  const dis = cb.dismissTension(doc, seg, who, 'Too few people to read')
  ok('dismiss is logged with a reason and leaves To review; restore brings it back', sg.tensionCounts(dis).toReview === sg.tensionCounts(doc).toReview - 1 && sg.tensionCounts(dis).dismissed === 1 && sg.tensionCounts(cb.restoreTension(dis, seg, who)).toReview === sg.tensionCounts(doc).toReview && dis.log[0].why === 'Too few people to read')
  // a face correction moves Showed: P-4101's warmest reaction at Mango corrected to Neutral
  const before = concept(doc, 'm-concept-b').showed.n
  const fixed = cb.correctFace(doc, 'm:m-concept-b:P-4101', 'P-4101', 'Delight', 'No clear expression', who, 'Not a smile')
  ok('"Not right?" on a first reaction moves Showed (Mango 9 to 8) and is logged', concept(fixed, 'm-concept-b').showed.n === before - 1 && fixed.log[0].action === 'Face reading corrected')
}

await vite.close()
if (failures.length) { console.error(`${n} checks, ${failures.length} failed\nA2 TENSIONS FAILED:\n - ${failures.join('\n - ')}`); process.exit(1) }
console.log(`${n} checks, 0 failed\nA2 TENSIONS OK`)
