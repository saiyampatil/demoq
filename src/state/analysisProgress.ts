// Where the Researcher is in Results Analysis: three steps, each with one finish line (docs/ANALYSIS_PLAN.md).
// Everything here is worked out from the codebook, so the stepper, the footer and the landing rule can never disagree.

import { useMemo } from 'react'
import { counts, unthemed, useCodebook, type CodebookDoc } from './codebook'
import { tensionCounts } from './signals'

export type AnalysisStepKey = 'codebook' | 'signals' | 'report'
export type StepProgress = 'Not started' | 'In progress' | 'Done'

export type AnalysisStep = {
  key: AnalysisStepKey
  label: string
  /** The screen ID in routes/screens.ts. */
  screenId: 'A1' | 'A2' | 'A3'
  status: StepProgress
  /** One line under the step: what is left, or what comes next. */
  hint: string
  locked: boolean
  lockedReason?: string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The three steps. A step opens once there is something to work on, and the only block is having no accepted code. */
export function analysisSteps(doc: CodebookDoc | undefined): AnalysisStep[] {
  const c = doc ? counts(doc) : undefined
  const noCodes = !c || c.accepted === 0
  const lockedReason = !doc ? 'Open the codebook first and accept the codes you want to analyse' : 'Accept at least one code in the codebook first'

  let codebook: Pick<AnalysisStep, 'status' | 'hint'>
  if (!c) codebook = { status: 'Not started', hint: 'Review the codes PulseAI suggested' }
  else if (c.suggested === 0 && c.themes > 0) codebook = { status: 'Done', hint: `Every code decided, ${plural(c.themes, 'theme')}` }
  else if (c.suggested === c.total && c.themes === 0) codebook = { status: 'Not started', hint: `${plural(c.suggested, 'code')} to review` }
  else if (c.suggested === 0) codebook = { status: 'In progress', hint: 'Group accepted codes into themes' }
  else codebook = { status: 'In progress', hint: `${plural(c.suggested, 'code')} to review` }

  let signals: Pick<AnalysisStep, 'status' | 'hint'> = { status: 'Not started', hint: 'How they said it, and where it doesn’t add up' }
  if (doc && !noCodes) {
    const t = tensionCounts(doc)
    if (t.total > 0 && t.toReview === 0) signals = { status: 'Done', hint: `Every tension decided, ${plural(t.themes, 'theme')} made` }
    else if (t.total - t.toReview > 0) signals = { status: 'In progress', hint: `${plural(t.toReview, 'tension')} to review` }
    else if (t.total > 0) signals = { status: 'Not started', hint: `${plural(t.toReview, 'tension')} to review` }
  }

  return [
    { key: 'codebook', label: 'Codebook', screenId: 'A1', ...codebook, locked: false },
    {
      key: 'signals',
      label: 'Signals & tensions',
      screenId: 'A2',
      ...signals,
      hint: noCodes ? 'Opens once a code is accepted' : signals.hint,
      locked: noCodes,
      lockedReason: noCodes ? lockedReason : undefined,
    },
    {
      key: 'report',
      label: 'Report',
      screenId: 'A3',
      status: 'Not started',
      hint: noCodes ? 'Opens once a code is accepted' : 'Findings, evidence and what goes to the client',
      locked: noCodes,
      lockedReason: noCodes ? lockedReason : undefined,
    },
  ]
}

export function useAnalysisSteps(studyId: string): AnalysisStep[] {
  const doc = useCodebook(studyId)
  return useMemo(() => analysisSteps(doc), [doc])
}

/** Where opening Analysis lands: the first open step that isn't done, so a returning Researcher resumes where they left off. */
export function resumeStep(steps: AnalysisStep[]): AnalysisStep {
  return steps.find((s) => !s.locked && s.status !== 'Done') ?? steps.filter((s) => !s.locked).at(-1) ?? steps[0]
}

/** What Continue checks. Warnings never block; only having nothing to analyse does. */
export type Readiness = {
  blocked?: string
  warnings: { key: string; text: string }[]
  facts: { label: string; value: string; ok: boolean }[]
}

export function codebookReadiness(doc: CodebookDoc, stale: boolean): Readiness {
  const c = counts(doc)
  const free = unthemed(doc).length
  const warnings: Readiness['warnings'] = []
  if (c.suggested > 0) warnings.push({ key: 'review', text: `${plural(c.suggested, 'code')} still to review will not be analysed. You can come back and accept them.` })
  if (c.themes === 0) warnings.push({ key: 'themes', text: 'There are no themes yet. Findings are written around themes, so add one when you’re ready.' })
  else if (free > 0) warnings.push({ key: 'free', text: `${plural(free, 'accepted code')} ${free === 1 ? 'is' : 'are'} not in a theme, so ${free === 1 ? 'it' : 'they'} won’t appear in a theme’s count.` })
  if (stale) warnings.push({ key: 'stale', text: 'Review changed since the codebook was built. Update the codebook so the counts match.' })
  return {
    blocked: c.accepted === 0 ? 'Accept at least one code to continue.' : undefined,
    warnings,
    facts: [
      { label: 'Accepted codes', value: String(c.accepted), ok: c.accepted > 0 },
      { label: 'Codes still to review', value: String(c.suggested), ok: c.suggested === 0 },
      { label: 'Themes', value: String(c.themes), ok: c.themes > 0 },
    ],
  }
}

/** What Continue checks on Signals & tensions. Tensions still to review are a warning, never a block. */
export function signalsReadiness(doc: CodebookDoc): Readiness {
  const t = tensionCounts(doc)
  const warnings: Readiness['warnings'] = []
  if (t.toReview > 0) warnings.push({ key: 'tensions', text: `${plural(t.toReview, 'tension')} still to review will not appear in the report. You can come back and decide them.` })
  return {
    warnings,
    facts: [
      { label: 'Tensions to review', value: String(t.toReview), ok: t.toReview === 0 },
      { label: 'Turned into themes', value: String(t.themes), ok: true },
      { label: 'Dismissed', value: String(t.dismissed), ok: true },
    ],
  }
}
