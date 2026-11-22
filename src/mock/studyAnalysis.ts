// What every study with a Results Analysis shares: which studies have one, and who belongs to which segment.
// Each study registers its own content here and in its own mock files (codebook, signals, emotion, report, showreel).
// Participant IDs, code IDs, question IDs and excerpt IDs are unique across studies (Pet Food: P-31xx and c-…; Ice Cream:
// P-41xx and ic-…), so a lookup by ID never needs to know the study. Only lists ("every code", "every moment") are per study.

/** One of the two groups a study compares. `key` is what is stored; the rest is how it reads on screen. */
export type SegmentInfo = {
  key: string
  /** Plural, capitalised: "Cat owners". */
  label: string
  /** Plural, lower case, for a sentence: "cat owners". */
  noun: string
  /** Singular, lower case: "cat owner". */
  one: string
}
/** The two groups a study compares, in the order they read on screen (the first group is on the left or the top). */
export type SegmentConfig = { first: SegmentInfo; second: SegmentInfo }

const configs = new Map<string, SegmentConfig>()
const memberOf = new Map<string, { studyId: string; key: string }>()

/** A study declares its two groups and who is in each. `members` maps a participant ID to a segment key. */
export function registerSegments(studyId: string, config: SegmentConfig, members: Record<string, string>) {
  configs.set(studyId, config)
  Object.entries(members).forEach(([participantId, key]) => memberOf.set(participantId, { studyId, key }))
}

/** The segment key of a participant, in any study. */
export const segmentOf = (participantId: string): string => memberOf.get(participantId)?.key ?? ''
/** The two groups of a study. */
export const segmentsOf = (studyId: string): SegmentConfig => {
  const c = configs.get(studyId)
  if (!c) throw new Error(`No segments registered for study ${studyId}`)
  return c
}
/** The two groups of the study a participant took part in. */
export const segmentsOfParticipant = (participantId: string): SegmentConfig => segmentsOf(memberOf.get(participantId)?.studyId ?? '')
/** How a participant's own segment reads in the singular: "cat owner", "parent". */
export const segmentWord = (participantId: string): string => {
  const m = memberOf.get(participantId)
  if (!m) return ''
  const c = segmentsOf(m.studyId)
  return (c.first.key === m.key ? c.first : c.second).one
}

const analysed: string[] = []
/** A study with a Results Analysis registers its ID once, from its codebook file. */
export function registerAnalysis(studyId: string) {
  if (!analysed.includes(studyId)) analysed.push(studyId)
}
export const hasAnalysis = (studyId: string | undefined): boolean => !!studyId && analysed.includes(studyId)
export const analysedStudies = (): string[] => [...analysed]
