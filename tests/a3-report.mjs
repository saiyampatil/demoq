// A3 report model, logic only (no page): the blocks, per-block approval and Out of date, the executive summary generator, its selection
// and its validator, the shared tension sentences, and the dev fixture. Runs the real modules through Vite's SSR loader:
//   node tests/a3-report.mjs
// Nothing here reads the old A3 page. Exit code is non-zero if any check fails, so tests/a3-report-mutations.mjs can use it.
import { createServer } from 'vite'

const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error' })
const m = (p) => vite.ssrLoadModule(p)
const cb = await m('/src/state/codebook.ts'), sess = await m('/src/mock/sessions.ts'), sd = await m('/src/state/seedDecisions.ts'), sg = await m('/src/state/signals.ts'), cn = await m('/src/state/concepts.ts')
const rb = await m('/src/state/reportBlocks.ts'), rs = await m('/src/state/reportSummary.ts'), ri = await m('/src/state/reportInputs.ts'), rp = await m('/src/state/report.ts'), fx = await m('/src/state/reportFixture.ts'), rl = await m('/src/state/reportLines.ts')
const ice = await m('/src/mock/iceCream.ts'), pet = await m('/src/mock/petFood.ts'), packs = await m('/src/mock/reportPacks.ts'), sa = await m('/src/mock/studyAnalysis.ts')
await m('/src/mock/iceCream/report.ts'); await m('/src/mock/report.ts')

const failures = []
let n = 0
const ok = (label, cond, detail) => { n++; if (!cond) failures.push(detail === undefined ? label : `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})`) }
const words = (t) => t.trim().split(/\s+/).length
const figs = (t) => [...t.matchAll(/\d+ of (?:the |those )?\d+/g)].length

const STUDY = 'ice-cream-flavours'
const seed = ice.seedIceCream()
const accepted = sess.STUDY_SEEDS[STUDY].filter((s) => s.variant === 'done' && s.review.status === 'Accepted').map((s) => ({ id: sess.sessionIdOf(s), participantId: s.participant }))
const basis = cb.basisOf(accepted)
const WHO = { by: 'Maya Ortiz' }
/** A fresh Ice Cream codebook with the seed's own decisions, as the page opens it. */
const fresh = () => { cb.resetCodebook(); cb.ensureCodebook(STUDY, accepted.map((a) => a.id)); sd.ensureSeedDecisions(STUDY, basis); return cb.getCodebook(STUDY) }
const inputs = (over = {}) => ({ ...ri.reportInputs({ studyId: STUDY, client: ice.ICE_RECORD.client, brief: seed.brief, guide: seed.guide, basis, excluded: 2 }), ...over })
const model = (over = {}, report) => rb.reportModel({ studyId: STUDY, doc: cb.getCodebook(STUDY), basis, inputs: inputs(over), report })
const update = (fn) => cb.updateCodebook(STUDY, fn)
const themeNow = (id) => sg.themeSignals(cb.getCodebook(STUDY), basis).find((t) => t.id === id)
const conceptNow = (key) => cn.conceptRows(cb.getCodebook(STUDY), basis).rows.find((r) => r.key === key)

// ═══ the starting point, default mode ═══
fresh()
const d0 = model()
ok('Ice Cream has 12 blocks in the default mode', d0.blocks.length === 12 && d0.counts.total === 12, d0.blocks.map((b) => b.id))
ok('blocks come in the specified order: summary, concepts, 7 questions in guide order, sounded, tensions, thin', d0.blocks.map((b) => b.id).join() === 'exec,concepts,q:iq-habit,q:iq-choose,q:iq-pick,q:iq-stop,q:iq-price,q:iq-when,q:iq-change,sounded,tensions,thin', d0.blocks.map((b) => b.id))
ok('nothing is seeded as approved: 0 of 12 approved, 12 to review', d0.counts.approved === 0 && d0.counts.toReview === 12 && d0.counts.undecided === 12 && !d0.counts.ready, d0.counts)
ok('question blocks are headed by the real guide question and numbered 1 to 7', d0.blocks.filter((b) => b.kind === 'question').map((b) => b.number).join() === '1,2,3,4,5,6,7' && d0.blocks.find((b) => b.id === 'q:iq-pick').title === 'Which of these three would you buy first, and why?')
ok('strengths: Weak is shown as Thin, Unanswered stays Unanswered, nothing is called Moderate', d0.blocks.filter((b) => b.strength).map((b) => b.strength.label).join() === 'Strong,Strong,Strong,Strong,Thin,Unanswered,Strong')
ok('the pack mapping agrees with the guide’s own covers tags, question by question', (() => {
  const objs = Object.fromEntries(seed.guide.guide.sections.flatMap((s) => s.questions).filter((q) => q.covers.length).map((q) => [q.text, q.covers[0]]))
  return cb.questionsOfStudy(STUDY).every((q) => packs.reportPackOf(STUDY).questionObjective[q.id] === objs[q.text])
})())

// ═══ only accepted A2 items are used ═══
{
  const a = d0.accepted
  ok('only what is accepted: one theme insight, one concept line, one Added tension', a.themes.map((x) => x.id).join() === 't-familiar' && a.concepts.map((x) => x.id).join() === 'concept:m-concept-c' && a.tensions.map((x) => x.id).join() === 'tn-cookie-locked', [a.themes.map((x) => x.id), a.concepts.map((x) => x.id), a.tensions.map((x) => x.id)])
  ok('the suggested ones (two themes, two concepts, three tensions) are never read', !d0.summary.chosen.some((c) => ['t-family', 't-curious', 'concept:m-concept-a', 'concept:m-concept-b', 'tn-segments', 'tn-mango-did', 'tn-caramel-mango-face'].includes(c.item.id)))
  const text = d0.blocks.flatMap((b) => b.lines.map((l) => l.text)).join(' ')
  ok('no text from an unaccepted item reaches the report: no Salted Caramel concept line, no “Parents choose for the whole family” insight', !/warmest first reaction for only 1 of 15/.test(text) && !/Parents choose/.test(text) && !/Curious about/.test(text))
}
// Left out is not accepted either.
{
  fresh()
  update((d) => cb.leaveOutInsight(d, { id: 't-familiar', name: 'x' }, themeNow('t-familiar').now, WHO, 'no'))
  const mm = model()
  ok('a theme insight that is Left out is not used, and its block goes away when none is left', !mm.accepted.themes.length && !mm.blocks.some((b) => b.id === 'sounded') && mm.counts.total === 11)
  update((d) => cb.leaveOutInsight(d, { id: 'concept:m-concept-c', name: 'x' }, conceptNow('concept:m-concept-c').now, WHO))
  ok('a concept line that is Left out is not used, and Concept results goes away when none is left', !model().blocks.some((b) => b.id === 'concepts') && model().counts.total === 10)
  update((d) => cb.dismissTension(d, { id: 'tn-cookie-locked', title: 't' }, WHO, 'no'))
  const m3 = model()
  ok('a Dismissed tension is not used, and Tensions goes away when none is Added', !m3.blocks.some((b) => b.id === 'tensions') && m3.counts.total === 9)
  ok('with nothing accepted the summary is the empty state: no findings, no firmness sentence, only the study and who took part', m3.summary.empty && m3.summary.lines.every((l) => l.part === 'study' || l.part === 'who') && m3.blocks[0].empty === true)
}
// Out of date is not accepted: adding a tension that touches an accepted insight makes it Out of date.
{
  fresh()
  const t = sg.tensionsOf(cb.getCodebook(STUDY), basis).find((x) => x.id === 'tn-segments')
  update((d) => cb.turnTensionIntoTheme(d, t, t.codeIds, t.themeName, t.summary, WHO))
  ok('an accepted concept line made Out of date by a new tension is no longer accepted', conceptNow('concept:m-concept-c').decision.status === 'Out of date' && !model().accepted.concepts.length && !model().summary.chosen.some((c) => c.item.id === 'concept:m-concept-c'))
}

// ═══ bullets are the accepted A2 sentences, verbatim ═══
fresh()
{
  const mm = model()
  const doc = cb.getCodebook(STUDY)
  ok('the concept bullet is the accepted concept line, word for word', mm.blocks.find((b) => b.id === 'concepts').lines[0].text === doc.insights['concept:m-concept-c'].text && doc.insights['concept:m-concept-c'].text === conceptNow('concept:m-concept-c').line)
  ok('the theme bullet is the accepted theme insight, word for word, led by the theme name', mm.blocks.find((b) => b.id === 'sounded').lines[0].text === doc.insights['t-familiar'].text && mm.blocks.find((b) => b.id === 'sounded').lines[0].lead === 'The safe choice wins the shelf')
  ok('an edited insight reads as the researcher’s wording, not the computed one', (() => {
    const now = themeNow('t-familiar').now
    const edited = now.text.replace('backed it up', 'matched what they said')
    update((d) => cb.editInsight(d, { id: 't-familiar', name: 'x' }, now, edited, WHO))
    return edited !== now.text && cb.getCodebook(STUDY).insights['t-familiar'].status === 'Edited' && model().blocks.find((b) => b.id === 'sounded').lines[0].text === edited
  })())
  fresh()
  const lines = model().blocks.find((b) => b.id === 'tensions').lines
  ok('the tension bullet is the shared tension sentence, led by its type, tagged Directional as A2 says', lines.length === 1 && lines[0].lead === 'Said vs locked answer' && lines[0].directional === true && lines[0].text === '3 of 7 people who picked Cookie Dough Crunch first answered “probably would not” or “definitely would not” in the locked survey.', lines[0])
}

// ═══ the shared tension sentence, all four kinds ═══
{
  fresh()
  const doc = cb.getCodebook(STUDY)
  const seg = sa.segmentsOf(STUDY)
  const by = Object.fromEntries(sg.tensionsOf(doc, basis).map((t) => [t.id, t]))
  const say = (id) => sg.tensionLines(by[id], [seg.first.label, seg.second.label])
  ok('Between segments: one sentence with one base, naming the group that leads', say('tn-segments').map((l) => l.text).join() === '5 of 8 parents would buy Cookie Dough Crunch first, a larger share than adults without children.', say('tn-segments'))
  ok('Said vs locked answer: 3 of 7', say('tn-cookie-locked')[0].text === '3 of 7 people who picked Cookie Dough Crunch first answered “probably would not” or “definitely would not” in the locked survey.')
  ok('Said vs did: 2 of 5', say('tn-mango-did')[0].text === '2 of 5 people who picked Mango Lassi first chose it to take home.', say('tn-mango-did'))
  ok('Said vs showed: 5 of 6 on video', say('tn-caramel-mango-face')[0].text === '5 of 6 people on video who said Salted Caramel Swirl first had their warmest first reaction at another concept.', say('tn-caramel-mango-face'))
  const all = ['tn-segments', 'tn-cookie-locked', 'tn-mango-did', 'tn-caramel-mango-face'].map((id) => say(id)[0])
  ok('every tension sentence has one base, at most 25 words, no percent and no face label', all.every((l) => figs(l.text) === 1 && words(l.text) <= 25 && !/%|percent/.test(l.text) && !/\bDelight|Interest|Surprise|Confusion|Doubt|Frustration|reads? as\b/.test(l.text)), all.map((l) => l.text))
  ok('the base in each sentence is the base it states (n and of match the text)', all.every((l) => l.text.startsWith(`${l.n} of ${l.of} `)))
  ok('equal shares in both groups say nothing', sg.tensionLines({ kind: 'Between segments', sides: [{ label: 'Parents a', n: 2, of: 4 }, { label: 'Parents b', n: 2, of: 4 }, { label: 'Adults a', n: 3, of: 6 }, { label: 'Adults b', n: 3, of: 6 }] }, ['Parents', 'Adults']).length === 0)
  ok('a side with no people says nothing', sg.tensionLines({ kind: 'Said vs did', sides: [{ label: 'Picked X', n: 0, of: 20 }, { label: 'Of those, chose X to take home', n: 0, of: 0 }] }).length === 0)
}

// ═══ the validator: each rule, a sentence that breaks it and one that does not ═══
{
  const src = { type: 'brief', section: 'objective' }
  const check = (text, over = {}) => rs.checkLine({ text, tag: 'Analysis', source: src, ...over })
  const good = '12 of 14 people were verbally positive about it, and their delivery backed it up.'
  ok('a clean sentence passes', check(good).length === 0, check(good))
  ok('rule: at most 25 words', check(Array(26).fill('word').join(' ')).length > 0 && check(Array(25).fill('word').join(' ')).length === 0)
  ok('rule: at most one “n of N people”', check('3 of 7 people said it and 4 of 9 people said another thing.').length > 0 && check('3 of 7 people said it.').length === 0)
  ok('rule: every sentence has a source', check(good, { source: undefined }).some((p) => /source/i.test(p)))
  ok('rule: every sentence has a tag', check(good, { tag: undefined }).some((p) => /tag/i.test(p)))
  ok('rule: no percentages', ['Half, 50%, said it.', 'About 50 percent said it.'].every((x) => check(x).length > 0) && check('Half of them said it.').length === 0)
  ok('rule: “most” only above half, in any wording', check('Most people said it: 3 of 10.').length > 0 && check('Most people said it: 6 of 10.').length === 0 && check('Most people said it.').length > 0 && check('Most of them sounded flat.').length > 0 && check('Most of them sounded flat, 3 of 10.').length > 0 && check('Most of them sounded flat, 6 of 10.').length === 0)
  ok('rule: no recommendation words', ['They should launch it.', 'We recommend Mango.', 'We suggest caramel.', 'Launch it in spring.'].every((t) => check(t).length > 0))
  ok('rule: no face labels', ['People looked like Delight.', 'It reads as interest at first sight.', 'Doubt showed on video.'].every((t) => check(t).length > 0) && check('The warmest first reaction was at Mango Lassi.').length === 0)
  ok('rule: no banned words', ['They felt happy.', 'A significant share said it.', 'Signals were mixed.', 'Their emotion score was high.', 'A micro-expression showed.', 'Some were uncertain.'].every((t) => check(t).length > 0))
}

// ═══ the executive summary: structure ═══
{
  fresh()
  const s = model().summary
  const text = s.lines.map((l) => l.text)
  ok('default mode: 7 sentences in the order A (2), B (1), C (3), D (1)', s.lines.length === 7 && s.lines.map((l) => l.part).join() === 'study,study,who,found,found,found,firm', s.lines.map((l) => l.part))
  ok('the summary is 120 to 220 words and within the hard cap', s.words >= 120 && s.words <= 220 && s.words === text.join(' ').split(/\s+/).length, s.words)
  ok('every sentence is 25 words at most, has one base at most, a source and a tag', s.lines.every((l) => words(l.text) <= 25 && figs(l.text) <= 1 && l.source && ['Brief', 'Setup', 'Analysis'].includes(l.tag)), text)
  ok('tags: the study is Brief and Setup, who took part is Setup, findings and firmness are Analysis', s.lines.map((l) => l.tag).join() === 'Brief,Setup,Setup,Analysis,Analysis,Analysis,Analysis')
  ok('sentence A names the client and the decision from the pack', text[0] === 'Scoop & Co is deciding which of three new tub ice cream flavours to pick first for a spring launch.')
  ok('sentence A2 names the active concepts of the approved guide', text[1] === 'This study tested Salted Caramel Swirl, Mango Lassi and Cookie Dough Crunch.')
  ok('sentence B: people, mode, and the two groups counted from the accepted sessions', text[2] === '20 people took part in AI-led interviews, 8 parents and 12 adults without children.')
  ok('no recommendation, no percent, nothing blocked', !text.some((t) => /should|recommend|%/.test(t)) && s.blocked.length === 0, s.blocked)
  ok('the researcher’s implications are not part of the summary and nothing is seeded for them', !s.lines.some((l) => /implication/i.test(l.text)) && !('implications' in s))
  ok('numbers are written by code and locked: no digit sits in a plain text part of any sentence', s.lines.every((l) => l.parts.filter((p) => p.t === 'text').every((p) => !/\d/.test(p.v)) && l.parts.map((p) => p.v).join('') === l.text) && s.lines.some((l) => l.parts.some((p) => p.t === 'fig')))
  ok('the findings lead with the primary objective’s item', s.chosen[0].objectiveId === 'o3', s.chosen.map((c) => c.objectiveId))
}

// ═══ selection ═══
{
  const I = { objectives: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }, { id: 'o3', text: 'C' }], primaryObjective: 'o2', questionObjective: { q1: 'o1', q2: 'o2', q3: 'o3' } }
  const item = (id, kind, people, over = {}) => ({ id, kind, name: id, text: id, people, gap: false, directional: false, questionIds: ['q1'], facts: { type: kind }, ...over })
  const sel = (acc, i = I) => rs.selectItems({ themes: [], concepts: [], tensions: [], ...acc }, i)
  // Which contender takes the objective's slot? The other three slots are filled with unmapped concept lines, so the loser cannot come in through the fill.
  const fillers = [0, 1, 2].map((i) => item(`f${i}`, 'concept', 30 - i, { questionIds: [] }))
  const one = { objectives: [{ id: 'o1', text: 'A' }], primaryObjective: 'o1', questionObjective: { q1: 'o1' } }
  const takes = (contenders) => sel({ themes: contenders.filter((c) => c.kind === 'theme'), tensions: contenders.filter((c) => c.kind === 'tension'), concepts: fillers }, one).chosen.map((c) => c.item.id).filter((id) => contenders.some((c) => c.id === id)).join()
  ok('for each objective the strongest item is taken: most people first', takes([item('small', 'theme', 6), item('big', 'theme', 14)]) === 'big' && takes([item('big', 'theme', 14), item('small', 'theme', 6)]) === 'big')
  ok('on a tie a Gap or Mixed item wins', takes([item('plain', 'theme', 10), item('gap', 'theme', 10, { gap: true })]) === 'gap' && takes([item('gap', 'theme', 10, { gap: true }), item('plain', 'theme', 10)]) === 'gap')
  ok('then a tension beats a non-tension', takes([item('t', 'theme', 10), item('tn', 'tension', 10)]) === 'tn' && takes([item('tn', 'tension', 10), item('t', 'theme', 10)]) === 'tn')
  ok('people outrank Gap, and Gap outranks being a tension', takes([item('few-gap', 'theme', 8, { gap: true }), item('many', 'theme', 12)]) === 'many' && takes([item('tn', 'tension', 10), item('gap', 'theme', 10, { gap: true })]) === 'gap')
  ok('an objective with no accepted item is returned as unmet, for part D', sel({ themes: [item('t', 'theme', 10)] }).unmet.map((u) => u.id).join() === 'o2,o3')
  const many = (k, n) => Array.from({ length: n }, (_, i) => item(`${k}${i}`, k, 20 - i, { questionIds: ['q1'] }))
  ok('never more than four items', sel({ concepts: many('concept', 3), tensions: many('tension', 3), themes: many('theme', 3) }).chosen.length === 4)
  ok('the remaining slots fill from concept lines, then tensions, then themes (with 3 of each and 4 slots: all 3 concepts, then 1 tension)', sel({ concepts: many('concept', 3), tensions: many('tension', 3), themes: many('theme', 3) }, { objectives: [], primaryObjective: undefined, questionObjective: {} }).chosen.map((c) => c.item.id).sort().join() === 'concept0,concept1,concept2,tension0')
  ok('the primary objective’s finding comes first, then the guide’s order', sel({ themes: [item('o1item', 'theme', 14, { questionIds: ['q1'] })], concepts: [item('o2item', 'concept', 12, { questionIds: ['q2'] })] }).chosen.map((c) => c.item.id).join() === 'o2item,o1item')
  ok('an item is never chosen twice', (() => { const c = sel({ themes: [item('only', 'theme', 14, { questionIds: ['q1', 'q2', 'q3'] })] }).chosen; return c.length === 1 })())
  ok('a study with no mapping still fills from concepts, tensions and themes, with no unmet objectives', (() => { const r = sel({ themes: [item('t', 'theme', 9)] }, { objectives: [], primaryObjective: undefined, questionObjective: {} }); return r.chosen.length === 1 && r.unmet.length === 0 })())
  // The whole summary: an objective with no accepted item is named under “How firm this is”.
  fresh()
  const s = model().summary
  ok('part D names the first two things the evidence is thin on and says how many more', s.lines.at(-1).text === 'Evidence is thin on their first reaction to each of the three new flavours, what they would expect to pay and 1 more.', s.lines.at(-1).text)
  ok('the objectives with no accepted item (first reactions, hold-backs, when) are the unmet ones', s.unmet.map((u) => u.id).join() === 'o2,o4,o5', s.unmet)
  ok('part D is one sentence of 25 words at most', words(s.lines.at(-1).text) <= 25 && !/[.!?] [A-Z]/.test(s.lines.at(-1).text))
  ok('no thin evidence and no unmet objective: part D is left out, and it never says everything was strong', rs.firmness({ objectives: [], primaryObjective: undefined }, [{ id: 'q', label: 'Q', n: 10, of: 20, notAsked: 0 }], [], false, true) === undefined)
}
// The hard cap: a summary over 250 words loses findings from the end. (The generator's own limits keep it under 200, so the guard is tested directly.)
{
  const L = (id, part, w) => ({ id, part, text: Array(w).fill('word').join(' '), parts: [], tag: 'Analysis', source: { type: 'brief', section: 'objective' } })
  const lines = [L('a', 'study', 25), L('b', 'who', 25), L('c1', 'found', 60), L('c2', 'found', 60), L('c3', 'found', 60), L('c4', 'found', 60), L('d', 'firm', 25)]
  const r = rs.fitToCap(lines)
  ok('over the hard cap the last findings are dropped until it fits, and the study, who and firmness sentences stay', r.words <= 250 && r.lines.map((l) => l.id).join() === 'a,b,c1,c2,d', [r.words, r.lines.map((l) => l.id)])
  ok('a summary within the cap is left alone', rs.fitToCap(lines.slice(0, 4)).lines.length === 4)
  ok('the cap is 250 words and the target 120 to 220', rs.SUMMARY_WORDS.cap === 250 && rs.SUMMARY_WORDS.target.join() === '120,220')
}

// ═══ missing inputs and the empty state ═══
{
  fresh()
  const noClient = model({ client: undefined }).summary
  ok('no client: sentence A is left out and “client” is reported missing, nothing guessed', !noClient.lines.some((l) => l.id === 'exec-a1') && noClient.missing.includes('client'))
  const noObjective = model({ objective: undefined }).summary
  ok('no brief objective: sentence A is left out and “objective” is reported missing', !noObjective.lines.some((l) => l.id === 'exec-a1') && noObjective.missing.includes('objective'))
  const noDecision = model({ decision: undefined }).summary
  ok('no decision phrase: sentence A is left out and “decision” is reported missing', !noDecision.lines.some((l) => l.id === 'exec-a1') && noDecision.missing.includes('decision'))
  ok('with every input present nothing is missing', model().summary.missing.length === 0)
  ok('no concept stimuli: the concept sentence and the Concept results block are left out', (() => { const mm = model({ stimuli: [] }); return !mm.summary.lines.some((l) => l.id === 'exec-a2') && !mm.blocks.some((b) => b.id === 'concepts') })())
}

// ═══ the other blocks ═══
{
  fresh()
  const mm = model()
  const thin = mm.blocks.find((b) => b.id === 'thin')
  ok('Where the evidence is thin: one bullet per Thin or Unanswered question, generated and validated', thin.lines.map((l) => `${l.lead}: ${l.text}`).join('|') === 'What they would expect to pay: Only 7 of 20 people answered; 1 person was not asked.|When they would eat it: No one answered; 5 of 20 people were not asked.', thin.lines.map((l) => l.text))
  ok('the thin line, for each case: some answered, none answered, with and without people not asked', rb.thinText({ n: 3, of: 20, notAsked: 0 }) === 'Only 3 of 20 people answered.' && rb.thinText({ n: 3, of: 20, notAsked: 1 }) === 'Only 3 of 20 people answered; 1 person was not asked.' && rb.thinText({ n: 3, of: 20, notAsked: 4 }) === 'Only 3 of 20 people answered; 4 people were not asked.' && rb.thinText({ n: 0, of: 20, notAsked: 0 }) === 'No one answered.' && rb.thinText({ n: 0, of: 20, notAsked: 5 }) === 'No one answered; 5 of 20 people were not asked.' && rb.thinText({ n: 1, of: 20, notAsked: 0 }) === 'Only 1 of 20 people answered.')
  ok('every thin bullet passes the same validator', thin.lines.every((l) => rs.checkLine(l).length === 0), thin.lines.map((l) => rs.checkLine(l)))
  ok('a Thin or unanswered question carries a flag; a Strong one does not', mm.blocks.filter((b) => b.kind === 'question').every((b) => (b.strength.label === 'Strong') === !b.flag))
  ok('the concept block ends with the face coverage line', mm.blocks.find((b) => b.id === 'concepts').footnote === 'Faces read at the reveal for 15 of 20 people · 5 audio-only, not read.')
  ok('the sounded block ends with A2’s speech coverage line', mm.blocks.find((b) => b.id === 'sounded').footnote === 'Speech read for 20 of 20 · 5 audio-only, read on speech · 2 excluded in Review are left out')
  ok('no block shows a face reading label or a percent', mm.blocks.every((b) => b.lines.every((l) => !/%|reads? as\b/.test(l.text))))
  ok('question blocks keep only finding sentences whose codes are accepted, three at most', mm.blocks.filter((b) => b.kind === 'question').every((b) => b.lines.length <= 3) && mm.blocks.find((b) => b.id === 'q:iq-change').lines.length === 0)
  ok('the group header line counts questions, approvals and thin ones', rb.questionGroupSummary(mm.blocks) === '7 questions · 0 approved · 2 flagged thin')
}

// ═══ a block's decision, its fingerprint, and Out of date ═══
{
  fresh()
  let doc = rp.newReport(STUDY)
  const find = (id, mm = model({}, doc)) => mm.blocks.find((b) => b.id === id)
  const concepts = find('concepts')
  doc = rp.approveBlock(doc, concepts, WHO)
  const dec = doc.decisions.concepts
  ok('approving records who, when, which report version and the fingerprint', dec.by === 'Maya Ortiz' && !!dec.at && dec.version === 1 && dec.fingerprint === concepts.fingerprint && dec.snapshot[0].text === concepts.lines[0].text, dec)
  ok('the block is Approved, and the counts say 1 of 12 approved, 11 to review', find('concepts').status === 'Approved' && model({}, doc).counts.approved === 1 && model({}, doc).counts.undecided === 11)
  ok('approval is per block: another block is untouched', find('exec').status === 'To review')
  // An input changes: another concept line is accepted in A2.
  update((d) => cb.acceptInsight(d, { id: 'concept:m-concept-a', name: 'x' }, conceptNow('concept:m-concept-a').now, WHO))
  const after = find('concepts')
  ok('when an input changes the approved block is Out of date, never rewritten silently', after.status === 'Out of date' && after.lines.length === 2 && after.was?.length === 1 && after.was[0].text === concepts.lines[0].text, [after.status, after.was])
  ok('Out of date shows the old wording beside the new: the old line is kept, the new block has the extra line', after.was?.length === 1 && after.lines.length === 2 && after.lines.some((l) => l.text === after.was[0].text))
  ok('the Out of date count feeds the same counter: 1 out of date, 12 undecided', model({}, doc).counts.outOfDate === 1 && model({}, doc).counts.undecided === 12)
  doc = rp.approveBlock(doc, after, WHO)
  ok('re-approving records the new fingerprint and the block is Approved again', find('concepts').status === 'Approved' && doc.decisions.concepts.fingerprint === after.fingerprint && doc.log[0].action === 'Re-approved')
  // Leave out.
  doc = rp.leaveOutBlock(doc, find('thin'), WHO, 'Not needed for the client')
  ok('Leave out records who, when and the reason, and counts as decided', find('thin').status === 'Left out' && doc.decisions.thin.reason === 'Not needed for the client' && model({}, doc).counts.leftOut === 1 && model({}, doc).counts.decided === 2)
  doc = rp.leaveOutBlock(doc, find('sounded'), WHO)
  update((d) => cb.acceptInsight(d, { id: 't-family', name: 'x' }, themeNow('t-family').now, WHO))
  ok('a Left out block stays Left out even when its own inputs change (a second theme insight is accepted)', find('sounded').lines.length === 2 && find('sounded').status === 'Left out' && !('reason' in doc.decisions.sounded))
  doc = rp.reopenBlock(doc, 'sounded', WHO)
  const prev = doc.decisions.thin
  doc = rp.reopenBlock(doc, 'thin', WHO)
  ok('putting a block back returns it to To review', find('thin').status === 'To review')
  doc = rp.restoreDecision(doc, 'thin', prev, WHO)
  ok('Undo puts back exactly the earlier decision', find('thin').status === 'Left out')
  ok('every decision is logged with who and what', doc.log.length >= 4 && doc.log.every((e) => e.by === 'Maya Ortiz' && e.action && e.blockId))
  // Everything decided: ready to publish.
  let all = doc
  for (const b of model({}, all).blocks) if (b.status !== 'Left out') all = rp.approveBlock(all, b, WHO)
  ok('when every block is decided the report is ready (and a Left out block counts as decided)', model({}, all).counts.ready && model({}, all).counts.undecided === 0)
  ok('the counter parts always add up to the total', (() => { const c = model({}, doc).counts; return c.approved + c.leftOut + c.toReview + c.outOfDate === c.total })())
}

// ═══ the stored report ═══
{
  ok('a report saved by the sentence-level version (schema 3) is not used, so its approvals are discarded', !rp.isCurrentReport({ studyId: STUDY, schema: 3, approvals: {} }) && rp.isCurrentReport(rp.newReport(STUDY)))
  ok('a new report holds no decisions and nothing published', Object.keys(rp.newReport(STUDY).decisions).length === 0 && rp.newReport(STUDY).published.length === 0)
}

// ═══ the dev fixture ═══
{
  const doc = fresh()
  const codesBefore = JSON.stringify(doc.codes.map((c) => [c.id, c.status]))
  const r = fx.applyA2Accepted(STUDY, basis, 'Maya Ortiz')
  const after = cb.getCodebook(STUDY)
  const mm = model()
  ok('the fixture adds the three tensions that were not yet Added, through the real Add function', r.tensionsAdded.join() === 'tn-segments,tn-mango-did,tn-caramel-mango-face', r)
  ok('it accepts the 3 theme insights and the 3 concept lines, and only those', r.themesAccepted.join() === 't-familiar,t-family,t-curious' && r.conceptsAccepted.join() === 'concept:m-concept-a,concept:m-concept-b,concept:m-concept-c', r)
  ok('the Waiting card stays Waiting and no codebook item is touched', sg.tensionsOf(after, basis).find((t) => t.id === 'tn-price-survey').status === 'Suggested' && JSON.stringify(after.codes.map((c) => [c.id, c.status])) === codesBefore)
  ok('nothing is Out of date at the end: every insight and every concept line is Accepted', sg.themeSignals(after, basis).filter((t) => ['t-familiar', 't-family', 't-curious'].includes(t.id)).every((t) => t.decision.status === 'Accepted') && cn.conceptRows(after, basis).rows.every((x) => x.decision.status === 'Accepted'))
  ok('fixture mode: still 12 blocks, with 3 concept bullets, 3 theme bullets, 4 tension bullets, all To review', mm.counts.total === 12 && mm.blocks.find((b) => b.id === 'concepts').lines.length === 3 && mm.blocks.find((b) => b.id === 'sounded').lines.length === 3 && mm.blocks.find((b) => b.id === 'tensions').lines.length === 4 && mm.counts.toReview === 12)
  ok('fixture summary: 8 sentences, 120 to 220 words, nothing blocked, firmness still the same', mm.summary.lines.length === 8 && mm.summary.words >= 120 && mm.summary.words <= 220 && mm.summary.blocked.length === 0, [mm.summary.lines.length, mm.summary.words])
  const again = fx.applyA2Accepted(STUDY, basis, 'Maya Ortiz')
  ok('running the fixture again changes nothing', again.tensionsAdded.length + again.themesAccepted.length + again.conceptsAccepted.length === 0, again)
  ok('the seed data is untouched: a fresh codebook is back to 1 theme, 1 concept line and 1 tension accepted', (() => { fresh(); const a = model().accepted; return a.themes.length === 1 && a.concepts.length === 1 && a.tensions.length === 1 })())
}

// ═══ Pet Food still builds ═══
{
  const PET = 'pet-food-churn'
  const ps = pet.seedPetFood()
  const acc = sess.STUDY_SEEDS[PET].filter((s) => s.variant === 'done' && s.review.status === 'Accepted').map((s) => ({ id: sess.sessionIdOf(s), participantId: s.participant }))
  const pb = cb.basisOf(acc)
  cb.ensureCodebook(PET, acc.map((a) => a.id)); sd.ensureSeedDecisions(PET, pb)
  const pi = ri.reportInputs({ studyId: PET, client: pet.PET_RECORD?.client, brief: ps.brief, guide: ps.guide, basis: pb })
  let mm
  try { mm = rb.reportModel({ studyId: PET, doc: cb.getCodebook(PET), basis: pb, inputs: pi }) } catch (e) { mm = e }
  ok('Pet Food builds a report without error (it has no decision phrase or objective mapping, so those sentences are left out)', !(mm instanceof Error) && mm.blocks.length > 0 && mm.blocks[0].id === 'exec', String(mm))
  ok('Pet Food’s summary reports the decision as missing instead of guessing', !(mm instanceof Error) && mm.summary.missing.includes('decision') && !mm.summary.lines.some((l) => l.id === 'exec-a1'))
}

await vite.close()
console.log(`${n} checks, ${failures.length} failed`)
if (failures.length) { console.log('A3 REPORT MODEL FAILED:'); failures.forEach((f) => console.log(' - ' + f)); process.exit(1) }
console.log('A3 report model: all checks passed')
