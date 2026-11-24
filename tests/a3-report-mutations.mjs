// Proof that tests/a3-report.mjs catches what it claims to: each rule is broken twice, on purpose, in the real source, and the test must
// fail each time. The source is put back after every run (and on exit), so nothing is left changed.
//   node tests/a3-report-mutations.mjs
// A mutation that SURVIVES (the test still passes) means a rule is not really tested. Exit code is non-zero if any survives.
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const F = {
  inputs: 'src/state/reportInputs.ts',
  blocks: 'src/state/reportBlocks.ts',
  summary: 'src/state/reportSummary.ts',
  store: 'src/state/report.ts',
  fixture: 'src/state/reportFixture.ts',
  signals: 'src/state/signals.ts',
}
// [rule, file, find, replace]. `find` must occur exactly once.
const M = [
  // only accepted items are used
  ['only accepted items', F.inputs, "status === 'Accepted' || status === 'Edited'", "status === 'Accepted' || status === 'Edited' || status === 'Left out'"],
  ['only accepted items', F.inputs, 'if (!d || !isAccepted(r.decision.status)) continue', 'if (!d) continue'],
  // bullets are the accepted A2 sentences, verbatim
  ['bullets verbatim', F.blocks, "verbatim(`concept:${x.id.replace(/^concept:/, '')}`, x.text,", "verbatim(`concept:${x.id.replace(/^concept:/, '')}`, x.text.replace('chose', 'picked'),"],
  ['bullets verbatim', F.blocks, "verbatim(`theme:${x.id}`, x.text,", "verbatim(`theme:${x.id}`, x.text.replace('verbally', 'verbal'),"],
  // counts agree
  ['counts agree', F.blocks, "undecided: c.toReview + c.outOfDate,", "undecided: c.toReview,"],
  ['counts agree', F.blocks, "approved: n('Approved'), leftOut", "approved: n('Approved') + n('Left out'), leftOut"],
  // Out of date
  ['out of date', F.blocks, "return d.fingerprint === fingerprint ? 'Approved' : 'Out of date'", "return 'Approved'"],
  ['out of date', F.blocks, "l: b.lines.map((l) => [l.id, l.text, !!l.directional])", "l: []"],
  // leave out
  ['left out stays left out', F.blocks, "if (d.status === 'Left out') return 'Left out'", "if (d.status === 'Left out' && d.fingerprint === fingerprint) return 'Left out'"],
  ['left out is decided', F.blocks, "decided: c.approved + c.leftOut,", "decided: c.approved,"],
  // decisions are recorded
  ['approval records version', F.store, 'version: nextVersion(d), fingerprint: block.fingerprint, snapshot: block.lines.map((l) => ({ id: l.id, text: l.text })) }\n  return { ...d, decisions: { ...d.decisions, [block.id]: decision }, log: logged(d, by, d.decisions', 'version: 0, fingerprint: block.fingerprint, snapshot: block.lines.map((l) => ({ id: l.id, text: l.text })) }\n  return { ...d, decisions: { ...d.decisions, [block.id]: decision }, log: logged(d, by, d.decisions'],
  ['approval records fingerprint', F.store, "status: 'Approved', by, at: now(), version: nextVersion(d), fingerprint: block.fingerprint", "status: 'Approved', by, at: now(), version: nextVersion(d), fingerprint: ''"],
  ['old approvals discarded', F.store, 'const SCHEMA = 4', 'const SCHEMA = 3'],
  ['leave out records reason', F.store, "...(reason?.trim() ? { reason: reason.trim() } : {}) }\n  return { ...d, decisions: { ...d.decisions, [block.id]: decision }, log: logged(d, by, 'Left out'", "}\n  return { ...d, decisions: { ...d.decisions, [block.id]: decision }, log: logged(d, by, 'Left out'"],
  // validator rules
  ['validator: 25 words', F.summary, 'export const MAX_SENTENCE_WORDS = 25', 'export const MAX_SENTENCE_WORDS = 30'],
  ['validator: 25 words', F.summary, 'maxWords: o.maxWords ?? MAX_SENTENCE_WORDS', 'maxWords: o.maxWords ?? 40'],
  ['validator: one n of N', F.summary, 'figuresAllowed: 1 })', 'figuresAllowed: 2 })'],
  ['validator: one n of N', F.summary, 'figuresAllowed: 1 })', 'figuresAllowed: 5 })'],
  ['validator: source', F.summary, "if (!l.source) problems.push('No source')", ''],
  ['validator: source', F.summary, "if (!l.source) problems.push('No source')", "if (l.source) problems.push('No source')"],
  ['validator: tag', F.summary, "if (!l.tag) problems.push('No tag (Brief, Setup or Analysis)')", ''],
  ['validator: tag', F.summary, "if (!l.tag) problems.push('No tag (Brief, Setup or Analysis)')", "if (l.tag) problems.push('No tag (Brief, Setup or Analysis)')"],
  ['validator: no percentages', F.summary, '.problems]\n  if (!l.source)', ".problems.filter((p) => !/percent/i.test(p))]\n  if (!l.source)"],
  ['validator: no percentages', F.summary, '.problems]\n  if (!l.source)', ".problems.filter((p) => p !== 'Uses a percentage')]\n  if (!l.source)"],
  ['validator: most above half', F.summary, "if (/\\bmost\\b/i.test(l.text)) {", "if (false) {"],
  ['validator: most above half', F.summary, 'n * 2 > of)) problems.push', 'n * 2 >= 0)) problems.push'],
  ['validator: no advice', F.summary, "const ADVICE = ['launch it']", 'const ADVICE: string[] = []'],
  ['validator: no advice', F.summary, "const ADVICE = ['launch it']", "const ADVICE = ['nothing']"],
  ['validator: no face labels', F.summary, '(Delight|Interest|Surprise|Neutral|Confusion|Doubt|Frustration)\\b|\\breads? as\\b', '(Interest|Surprise|Neutral|Confusion|Frustration)\\b|\\breads? as\\b'],
  ['validator: no face labels', F.summary, '|\\breads? as\\b/', '/'],
  ['validator: no banned words', F.summary, "const NEVER_SHOWN = ['emotion score', 'high emotion', 'micro-expression', 'signals', 'fits', 'uncertain']", 'const NEVER_SHOWN: string[] = []'],
  ['validator: no banned words', F.summary, "'micro-expression', 'signals', 'fits'", "'micro-expression', 'fits'"],
  // selection
  ['selection: most people first', F.summary, 'b.people - a.people ||', 'a.people - b.people ||'],
  ['selection: most people first', F.summary, ".sort(rank)[0]\n    if (best", ".sort(rank).reverse()[0]\n    if (best"],
  ['selection: Gap or Mixed on a tie', F.summary, 'Number(b.gap) - Number(a.gap) ||', 'Number(a.gap) - Number(b.gap) ||'],
  ['selection: Gap or Mixed on a tie', F.summary, 'Number(b.gap) - Number(a.gap) ||', ''],
  ['selection: a tension on a tie', F.summary, "Number(b.kind === 'tension') - Number(a.kind === 'tension') ||", ''],
  ['selection: a tension on a tie', F.summary, "Number(b.kind === 'tension') - Number(a.kind === 'tension') ||", "Number(a.kind === 'tension') - Number(b.kind === 'tension') ||"],
  ['selection: at most four', F.summary, 'export const MAX_FOUND = 4', 'export const MAX_FOUND = 5'],
  ['selection: at most four', F.summary, "for (const x of pool) if (chosen.length < MAX_FOUND)", 'for (const x of pool) if (chosen.length < 99)'],
  ['selection: fill order', F.summary, "for (const kind of ['concept', 'tension', 'theme'] as const)", "for (const kind of ['theme', 'tension', 'concept'] as const)"],
  ['selection: fill order', F.summary, "for (const kind of ['concept', 'tension', 'theme'] as const)", "for (const kind of ['tension', 'concept', 'theme'] as const)"],
  ['selection: unmet objective to part D', F.summary, "      unmet.push(o)\n      continue", '      continue'],
  ['selection: unmet objective to part D', F.summary, 'if (!mapped.length) {', 'if (false) {'],
  ['selection: primary objective first', F.summary, 'Number(b.id === i.primaryObjective) - Number(a.id === i.primaryObjective)', 'Number(a.id === i.primaryObjective) - Number(b.id === i.primaryObjective)'],
  ['selection: primary objective first', F.summary, 'Number(b.id === i.primaryObjective) - Number(a.id === i.primaryObjective)', '0'],
  ['selection: an item once', F.summary, ".filter((x) => !chosen.some((c) => c.item.id === x.id)).sort(rank)[0]", '.sort(rank)[0]'],
  ['selection: an item once', F.summary, '.filter((x) => !chosen.some((c) => c.item.id === x.id)).sort(rank)\n    for', '.sort(rank)\n    for'],
  // summary structure
  ['missing client or objective', F.summary, 'if (i.client && i.objective && i.decision) push(', 'if (true) push('],
  ['missing client or objective', F.summary, "if (!i.client) missing.push('client')", ''],
  ['empty state', F.summary, 'const empty = a.themes.length + a.concepts.length + a.tensions.length === 0', 'const empty = false'],
  ['empty state', F.blocks, 'empty: summary.empty,', 'empty: false,'],
  ['part D names two, then how many more', F.summary, 'const shown = names.slice(0, 2)', 'const shown = names.slice(0, 3)'],
  ['part D names two, then how many more', F.summary, "fig(String(more)), txt(' more')", "fig(String(more)), txt(' others')"],
  ['block rules: concept results need stimuli', F.blocks, 'if (inputs.stimuli.length && accepted.concepts.length && concepts) {', 'if (accepted.concepts.length && concepts) {'],
  ['block rules: sounded needs an accepted theme', F.blocks, 'if (accepted.themes.length) {', 'if (true) {'],
  ['thin evidence wording', F.blocks, '`Only ${q.n} of ${q.of} people answered.`', '`Just ${q.n} of ${q.of} people answered.`'],
  ['thin evidence wording', F.blocks, "'No one answered.'", "'Nobody answered.'"],
  ['thin evidence: one person is not no one', F.blocks, 'if (q.n === 0) return', 'if (q.n <= 1) return'],
  ['thin evidence: one person is not no one', F.blocks, "? `No one answered; ${q.notAsked} of ${q.of} people were not asked.`", "? `Nobody answered; ${q.notAsked} of ${q.of} people were not asked.`"],
  // the fixture
  ['fixture: only plain themes', F.fixture, 'if (!plainThemes.has(s.id) || !s.decidable', 'if (!s.decidable'],
  ['fixture: re-accept what went Out of date', F.fixture, "s === 'Suggested' || s === 'Out of date'", "s === 'Suggested'"],
  ['fixture: leave the Waiting card', F.fixture, "if (t.unavailable || status === 'Added as a tension theme') continue", "if (status === 'Added as a tension theme') continue"],
  // the shared tension sentence
  ['tension sentence: survey wording', F.signals, '${surveyWords(lowerFirst(afterOfThose(s1.label)))}', '${lowerFirst(afterOfThose(s1.label))}'],
  ['tension sentence: who said it', F.signals, ".replace(/ as the one they would buy first$/, ' first')", ''],
  ['tension sentence: the answer that differs most', F.signals, 'Math.abs(gap[1]) > Math.abs(gap[0])', 'Math.abs(gap[1]) < Math.abs(gap[0])'],
]

const original = new Map()
const restore = () => original.forEach((src, file) => writeFileSync(file, src))
process.on('exit', restore)
process.on('SIGINT', () => process.exit(130))

// The unmutated test must pass first, or "it failed" proves nothing.
const base = spawnSync('node', ['tests/a3-report.mjs'], { encoding: 'utf8' })
if (base.status !== 0) { console.log('The unmutated test fails. Fix that first.\n' + base.stdout.slice(0, 600)); process.exit(2) }

let survived = 0
const byRule = new Map()
for (const [rule, file, find, replace] of M) {
  if (!original.has(file)) original.set(file, readFileSync(file, 'utf8'))
  const src = original.get(file)
  const count = src.split(find).length - 1
  if (count !== 1) { console.log(`BAD MUTATION (${count} matches) [${rule}]: ${find.slice(0, 70)}`); survived++; continue }
  writeFileSync(file, src.replace(find, () => replace))
  const r = spawnSync('node', ['tests/a3-report.mjs'], { encoding: 'utf8' })
  writeFileSync(file, src)
  const caught = r.status !== 0
  const first = (r.stdout.split('\n').find((l) => l.startsWith(' - ')) ?? r.stderr.split('\n').find((l) => /Error/.test(l)) ?? '').slice(0, 110)
  if (!caught) survived++
  const list = byRule.get(rule) ?? []
  list.push(caught)
  byRule.set(rule, list)
  console.log(`${caught ? 'caught  ' : 'SURVIVED'} [${rule}] ${first}`)
}
console.log('')
for (const [rule, list] of byRule) console.log(`${list.every(Boolean) ? 'ok ' : 'XX '} ${rule}: ${list.filter(Boolean).length} of ${list.length} mutations caught`)
console.log(`\n${M.length} mutations, ${survived} survived`)
process.exit(survived ? 1 : 0)
