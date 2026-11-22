// The registries every study adds its signal content to: its concept moments, its tensions, who hesitated at each concept's
// first reaction and how often people hesitated on each code. IDs of participants and codes are unique across studies, so the
// per-person and per-code tables are shared; only the concept moments and the tension list are per study.
// Pet Food's content is in signals.ts, Ice Cream's in iceCream/signals.ts. This file imports neither (types only), so both can import it.

import type { Moment, TensionDef } from './signals'

export type SignalPack = {
  studyId: string
  /** The key moments that are not guide questions: the first reaction to each concept. */
  concepts: Moment[]
  /** What the system suggests for this study. */
  tensions: TensionDef[]
}

export const SIGNAL_PACKS: Record<string, SignalPack> = {}
export const registerSignalPack = (pack: SignalPack) => {
  SIGNAL_PACKS[pack.studyId] = pack
}

/** Who hesitated at each concept's first reaction, by moment ID. People in neither list were steady. Participant IDs are unique, so studies share this table. */
export const REACTIONS: Record<string, { marked: string[]; some: string[] }> = {}
/** Who never saw a concept (a failed card), by moment ID: there is no reaction to measure. */
export const NOT_SEEN: Record<string, string[]> = {}
/** [marked, some] among the people who said each code. Codes not listed are all steady. */
export const PLAN: Record<string, [number, number]> = {}

/** Adds one study's lists to the shared tables, joining a moment's lists when two studies use the same moment ID. */
export function addReactions(reactions: Record<string, { marked: string[]; some: string[] }>, notSeen: Record<string, string[]> = {}) {
  Object.entries(reactions).forEach(([id, r]) => {
    const cur = REACTIONS[id] ?? { marked: [], some: [] }
    REACTIONS[id] = { marked: [...cur.marked, ...r.marked], some: [...cur.some, ...r.some] }
  })
  Object.entries(notSeen).forEach(([id, list]) => (NOT_SEEN[id] = [...(NOT_SEEN[id] ?? []), ...list]))
}
