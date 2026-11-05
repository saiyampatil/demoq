import type { Basis, CodebookDoc } from '@/state/codebook'

/** What every part of the codebook page reads and writes through. */
export type CodebookCtx = {
  doc: CodebookDoc
  /** Who and what the counts are against right now. */
  basis: Basis
  me: string
  studyId: string
  act: (fn: (d: CodebookDoc) => CodebookDoc) => void
}
