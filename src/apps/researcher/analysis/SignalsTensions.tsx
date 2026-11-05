import { counts } from '@/state/codebook'
import { StepPage } from './StepPage'
import { useAnalysis } from './useAnalysis'

/** A2: how they said it, and where it doesn't add up. The frame is in place; the measurements come in the next stage. */
export function SignalsTensions() {
  const { studyId, ready, stale, doc, accepted } = useAnalysis()
  const c = doc ? counts(doc) : undefined
  const video = accepted.filter((a) => (a.media ?? 'Video') === 'Video').length
  const surveyQs = accepted[0]?.survey.length ?? 0
  return (
    <StepPage
      id="A2"
      step="signals"
      studyId={studyId}
      title="Signals & tensions"
      description="How people said it, and where what they said doesn’t add up. Behaviour is described, never diagnosed, and never used to exclude a session."
      ready={ready}
      stale={stale}
      takesIn={[
        { label: 'Accepted codes', value: String(c?.accepted ?? 0), note: 'With their quotes and timestamps' },
        { label: 'Themes', value: String(c?.themes ?? 0) },
        { label: 'Sessions', value: String(accepted.length), note: 'Accepted in Review' },
        { label: 'With video', value: `${video} of ${accepted.length}`, note: `${accepted.length - video} audio-only. Facial analysis is on hold.` },
        { label: 'Locked survey answers', value: String(surveyQs), note: 'Per session' },
        { label: 'Segments', value: 'Dog or cat owner, region', note: 'From screening' },
      ]}
      youDecide={[
        'Accept a tension (and turn it into a theme) or dismiss it, with a reason.',
        'Untick any signal you don’t want in the report.',
      ]}
      handsOn={[
        'Signals per code, theme and key moment: hesitation in n of M people, with timestamps and the reason.',
        'Accepted tensions: what each side says in n of N, with the quotes.',
        'Dismissed tensions stay in the log with their reasons and never reach the client.',
        'Coverage: who has video, who is audio-only, who was excluded.',
      ]}
      previous={{ screen: 'A1', label: 'Codebook' }}
      next={{ screen: 'A3', label: 'Continue to Report' }}
    />
  )
}
