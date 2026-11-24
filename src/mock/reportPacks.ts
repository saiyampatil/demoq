// What the Report, the executive summary, the audio summary and the showreel say that belongs to one study. Each study registers
// its own pack (Pet Food in src/mock/report.ts, Ice Cream in src/mock/iceCream/report.ts); the state files ask for the pack of
// the study they are working on and never name a code, a tension or a flavour themselves. Code and tension IDs are unique across
// studies, so a lookup by ID alone also works (a clip knows its code, not its study).
import type { Citation, Sentence } from '@/state/report'

/** A seed sentence: `text` is filled in from the template when the report is made. */
export type SeedSentence = Omit<Sentence, 'text'> & { template: string }

/** A side of a tension card, as the signals state gives it. */
export type TensionSide = { n: number; of: number }

/**
 * How one tension reads in the executive summary and the audio summary. Numbers in the executive summary are live tokens;
 * the audio lines are plain text with the numbers already worked out.
 */
export type TensionNarration = {
  /** The executive summary sentence once the Researcher added the tension as a theme, with {side:ID:i:n|of} tokens. Undefined when there is nothing true to say. */
  exec?: (tok: (i: number) => string, sides: TensionSide[]) => string | undefined
  /** The one pair of numbers the audio line states. Default: the second side. Undefined when there is no single number. */
  nums?: (sides: TensionSide[]) => TensionSide | undefined
  /** The audio narration line. A tension without one is never narrated. */
  audio?: (n: number, of: number, sides: TensionSide[]) => string
  /** Other wordings of the same claim, for Rewrite. */
  alts?: (n: number, of: number) => string[]
  /** The line is about faces, so it says what a face read as. */
  faceBased?: boolean
}

export type ReportPack = {
  studyId: string
  /** The report's findings: pre-written drafts by guide question. */
  findingDrafts: Record<string, SeedSentence[]>
  /** The tensions this study can suggest, by ID. */
  tensions: Record<string, TensionNarration>
  /** The concept a code is about, for the showreel's Stimulus filter. */
  stimulusOfCode: Record<string, 'Concept A' | 'Concept B' | 'Concept C'>
  /** Placeholder text in the showreel's regenerate box, e.g. "More from dog owners". */
  regenerateExample: string
  /** Example ideas offered under Highlights, and the one in its search box. */
  highlightExamples: string[]
  /** What a Researcher might type into the audio summary's focus box. */
  focusExample: string
  // ── A3 report: what the executive summary needs that the brief and the guide do not hold as fields ──
  // In production the AI paraphrases the approved brief, and the objectives come from the brief module. Here they are one small
  // table per study, so the prototype can say them without guessing. A study without them omits the sentence that needs them.
  /** The decision the client is making, in the brief's own words, to finish "{Client} is deciding ...". */
  decision?: string
  /** The approved guide's objective the brief's first sentence is about. The summary leads with its finding. */
  primaryObjective?: string
  /** Each guide question's objective (the guide's own `covers` tags, written out once). */
  questionObjective?: Record<string, string>
  /** The guide question that concept lines and every kind of tension answer. */
  pickQuestion?: string
}

const packs = new Map<string, ReportPack>()
export const registerReportPack = (p: ReportPack) => void packs.set(p.studyId, p)
export const reportPackOf = (studyId: string): ReportPack | undefined => packs.get(studyId)
/** The pack that knows a tension, found by ID alone (tension IDs are unique across studies). */
export const tensionNarrationOf = (tensionId: string): TensionNarration | undefined => [...packs.values()].map((p) => p.tensions[tensionId]).find(Boolean)
export const stimulusOfCodeId = (codeId: string) => [...packs.values()].map((p) => p.stimulusOfCode[codeId]).find(Boolean)

export type { Citation }
