// The decisions a study's seed already holds on its insights (a theme accepted, a concept line accepted), put in place the first time its
// analysis opens. They go through the same accept function as a click, so each one carries the fingerprint of what it was made from and
// is Out of date the moment the data moves. Needs the signals, so it lives here and not in codebook.ts.

import { CODEBOOK_PACKS } from '@/mock/codebookKit'
import { acceptInsight, getCodebook, updateCodebook, type Basis } from './codebook'
import { conceptRows } from './concepts'
import { themeSignals } from './signals'

export function ensureSeedDecisions(studyId: string, basis: Basis) {
  const doc = getCodebook(studyId)
  const seeds = CODEBOOK_PACKS[studyId]?.insightDecisions ?? []
  if (!doc || doc.decisionsSeeded) return
  if (!seeds.length) return
  updateCodebook(studyId, (d) => {
    let next = d
    const themes = themeSignals(d, basis)
    const concepts = conceptRows(d, basis)?.rows ?? []
    for (const s of seeds) {
      const theme = themes.find((t) => t.id === s.key)
      const concept = concepts.find((c) => c.key === s.key)
      const target = theme ? { ref: { id: theme.id, name: theme.name }, now: theme.now } : concept ? { ref: { id: concept.key, name: concept.name }, now: concept.now } : undefined
      if (!target?.now?.text) continue
      const done = acceptInsight(next, target.ref, target.now, { by: s.by })
      // The decision and its log line carry the seed's own time, not today's.
      next = {
        ...done,
        insights: { ...done.insights, [target.ref.id]: { ...done.insights![target.ref.id], at: s.at } },
        log: done.log.map((e, i) => (i === 0 ? { ...e, at: s.at } : e)),
      }
    }
    return { ...next, decisionsSeeded: true }
  })
}
