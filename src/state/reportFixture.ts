// Dev only: fill the report by accepting everything in A2, through the real functions a click calls. Never the default, and it never
// edits seed data: it writes to the codebook store the same way the A2 buttons do, so Reset seed puts it back.
//
// The order matters, because adding a tension marks the accepted insights it touches Out of date:
//   1. Add the tensions that can be added (not the one still Waiting) with the real Add function.
//   2. Then accept every theme insight and every concept line. An insight the first step made Out of date is accepted again.
// No codebook item is touched, and the Waiting card stays Waiting.
import { acceptInsight, codeThemes, getCodebook, tensionDecisions, turnTensionIntoTheme, updateCodebook, type Basis } from './codebook'
import { conceptRows } from './concepts'
import { themeSignals, tensionsOf } from './signals'

export const FIXTURE_PARAM = 'fixture'
export const FIXTURE_VALUE = 'a2-accepted'

export type FixtureResult = { tensionsAdded: string[]; themesAccepted: string[]; conceptsAccepted: string[] }

export function applyA2Accepted(studyId: string, basis: Basis, by: string): FixtureResult {
  const out: FixtureResult = { tensionsAdded: [], themesAccepted: [], conceptsAccepted: [] }
  const doc0 = getCodebook(studyId)
  if (!doc0) return out

  // 1. Tensions, through the Add function A2's dialog calls.
  for (const t of tensionsOf(doc0, basis)) {
    const status = tensionDecisions(getCodebook(studyId)!)[t.id]?.status
    if (t.unavailable || status === 'Added as a tension theme') continue
    updateCodebook(studyId, (d) => turnTensionIntoTheme(d, t, t.codeIds, t.themeName, t.summary, { by }))
    out.tensionsAdded.push(t.id)
  }

  // 2. Insights, worked out again now that the tensions are in (they are part of each insight's fingerprint).
  const decidable = (s: string) => s === 'Suggested' || s === 'Out of date'
  // Tension themes have no verdict of their own in A2, so they are not insights to accept.
  const plainThemes = new Set(codeThemes(getCodebook(studyId)!).map((t) => t.id))
  for (const s of themeSignals(getCodebook(studyId)!, basis)) {
    if (!plainThemes.has(s.id) || !s.decidable || !s.now?.text || !s.decision || !decidable(s.decision.status)) continue
    updateCodebook(studyId, (d) => acceptInsight(d, { id: s.id, name: s.name }, s.now!, { by }))
    out.themesAccepted.push(s.id)
  }
  for (const r of conceptRows(getCodebook(studyId)!, basis)?.rows ?? []) {
    if (!r.now.text || !decidable(r.decision.status)) continue
    updateCodebook(studyId, (d) => acceptInsight(d, { id: r.key, name: r.name }, r.now, { by }))
    out.conceptsAccepted.push(r.key)
  }
  return out
}
