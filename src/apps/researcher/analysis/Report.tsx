import { useStudies } from '@/state/StudyContext'
import { counts } from '@/state/codebook'
import { allQuestions } from '@/state/guide'
import { StepPage } from './StepPage'
import { useAnalysis } from './useAnalysis'

/** A3: the report. Findings by guide question, theme evidence and media, in one place, then published to the client. */
export function Report() {
  const { studyId, ready, stale, doc, accepted } = useAnalysis()
  const { getGuide } = useStudies()
  const guide = getGuide(studyId)?.guide
  const questions = guide ? allQuestions(guide).filter((q) => q.mandatory).length : 0
  const c = doc ? counts(doc) : undefined
  return (
    <StepPage
      id="A3"
      step="report"
      studyId={studyId}
      title="Report"
      description="The story for the client: a finding for each guide question, backed by quotes, themes and clips. Nothing reaches the client until you publish."
      ready={ready}
      stale={stale}
      takesIn={[
        { label: 'Accepted codes', value: String(c?.accepted ?? 0) },
        { label: 'Themes', value: String(c?.themes ?? 0) },
        { label: 'Sessions', value: String(accepted.length), note: 'Accepted in Review' },
        { label: 'Guide questions that need an answer', value: String(questions), note: 'Each gets a finding' },
        { label: 'Signals & tensions', value: 'Not started', note: 'Accepted tensions appear in the findings' },
      ]}
      youDecide={[
        'Edit any paragraph, or write your own version beside PulseAI’s draft.',
        'Keep or remove each section and each tension.',
        'Publish version 1 to the client. A published version never changes.',
      ]}
      handsOn={[
        'A versioned report snapshot for the client, with every claim linked to its quote and timestamp.',
        'Questions that are weakly supported or unanswered are flagged before you publish.',
        'If Review or the codebook changes later, the report shows as out of date.',
      ]}
      previous={{ screen: 'A2', label: 'Signals & tensions' }}
    />
  )
}
