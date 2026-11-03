import { cn } from '@/components/cn'
import { Button } from '@/components/Button'
import { AlertIcon } from '@/components/icons'
import { Tooltip } from '@/components/Tooltip'
import { screenById, studyPath } from '@/routes/screens'
import type { ReserveCandidate } from '@/state/fieldwork'
import type { Ledger, Verdict, VerdictAction, VerdictLevel } from '@/state/selectors'
import { SlotLedger } from './SlotLedger'

/** The colour carries the verdict and nothing else: an accent on the card edge and the status word. */
const TONE: Record<VerdictLevel, { edge: string; word: string }> = {
  'At risk': { edge: 'border-l-negative-fg', word: 'text-negative-fg' },
  'Behind pace': { edge: 'border-l-pending-fg', word: 'text-pending-fg' },
  'On track': { edge: 'border-l-positive-fg', word: 'text-positive-fg' },
}

type Props = {
  v: Verdict
  ledger: Ledger
  reserve: ReserveCandidate[]
  studyId: string
  blockedWhy?: string
  /** Applicants a top-up has already moved into the reserve, not invited yet. */
  newInReserve: number
  closed: boolean
  /** Fewer days left than a new person needs. */
  notEnoughTime?: { left: number; needed: number }
  /** Days left in the window, or null when no window is set. */
  daysLeft: number | null
  goTab: (t: string) => void
  onInvite: (n: number) => void
  onAdjust: (k: 'extend' | 'lower') => void
}

/**
 * Three zones: the verdict in one sentence (left), the slots (middle), the one thing to do (right). The arithmetic and
 * the list of slots that opened are in "How these numbers are calculated" at the bottom of the Overview.
 */
export function VerdictCard({ v, ledger, reserve, studyId, blockedWhy, newInReserve, closed, notEnoughTime, daysLeft, goTab, onInvite, onAdjust }: Props) {
  const tone = TONE[v.level]
  const plan = v.plan
  // At risk leads with coverage, which is already one sentence. The other two say how far along the study is.
  const sentence = v.level === 'At risk' ? v.sentence : `${v.figures.toward} of ${v.gap.target} done${daysLeft === null ? '' : `, ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}.`
  // On track needs nothing from the Researcher here, so it has no button; Needs you below carries what is left to do.
  const actions = v.level === 'On track' ? [] : v.actions

  return (
    <section aria-label="Verdict" data-level={v.level} className={cn('rounded-md border border-l-4 border-mist bg-surface', tone.edge)}>
      <div className="grid gap-x-8 gap-y-5 p-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_auto]">
        <div className="min-w-0">
          <p className={cn('text-xl font-semibold', tone.word)}>{v.level}</p>
          <p className="mt-1 text-md text-ink tabular-nums" data-testid="verdict-sentence">
            {sentence}
          </p>
          {newInReserve > 0 && (
            <p className="mt-1 text-sm font-medium text-positive-fg tabular-nums" data-testid="new-in-reserve">
              {newInReserve} new in reserve ·{' '}
              {blockedWhy ? (
                <span className="text-graphite">Invite</span>
              ) : (
                <button type="button" onClick={() => onInvite(reserve.length)} className="underline">
                  Invite
                </button>
              )}
            </p>
          )}
        </div>

        <div className="min-w-0 max-xl:order-3">
          <SlotLedger ledger={ledger} />
        </div>

        {actions.length > 0 && (
          <div className="flex shrink-0 flex-col items-start gap-2 max-xl:order-2 xl:items-stretch" aria-label="Verdict actions">
            {actions.map((a, i) => (
              <VerdictButton key={a.label} action={a} primary={i === 0} blockedWhy={blockedWhy} studyId={studyId} goTab={goTab} onInvite={onInvite} />
            ))}
          </div>
        )}
      </div>

      {plan && plan.source > 0 && notEnoughTime && !closed && (
        <div className="mx-5 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border border-negative-line bg-negative-bg px-3 py-2 text-sm" data-testid="not-enough-time">
          <p className="flex min-w-0 flex-1 basis-72 items-start gap-2 text-negative-fg">
            <AlertIcon size={14} className="mt-0.5 shrink-0" />
            <span className="tabular-nums">
              <span className="font-medium">Not enough time left.</span> {notEnoughTime.left} {notEnoughTime.left === 1 ? 'day' : 'days'} left, and a new person needs about {notEnoughTime.needed} days to be sourced, screened and interviewed.
            </span>
          </p>
          <span className="flex gap-2">
            <Button size="sm" disabled={!!blockedWhy} onClick={() => onAdjust('extend')}>
              Extend window
            </Button>
            <Button size="sm" disabled={!!blockedWhy} onClick={() => onAdjust('lower')}>
              Lower target
            </Button>
          </span>
        </div>
      )}

    </section>
  )
}

/** The primary action reads as enabled: a large solid button. When something blocks it, it is disabled and says why. */
function VerdictButton({ action, primary, blockedWhy, studyId, goTab, onInvite }: { action: VerdictAction; primary: boolean; blockedWhy?: string; studyId: string; goTab: (t: string) => void; onInvite: (n: number) => void }) {
  const fills = action.kind === 'invite' || action.kind === 'source'
  const variant = primary ? 'primary' : 'secondary'
  const big = 'h-10 px-5 text-md'
  if (fills && blockedWhy)
    return (
      <Tooltip content={blockedWhy} focusable>
        <Button variant={variant} className={big} disabled>
          {action.label}
        </Button>
      </Tooltip>
    )
  if (action.kind === 'invite')
    return (
      <Button variant={variant} className={big} onClick={() => onInvite(action.n ?? 0)}>
        {action.label}
      </Button>
    )
  // Source more opens R8 as a top-up with the number to source filled in.
  if (action.kind === 'source')
    return (
      <Button variant={variant} className={big} data-testid="source-more" to={`${studyPath(studyId, screenById.R8)}?topup=${action.n}`}>
        {action.label}
      </Button>
    )
  if (action.kind === 'sessions')
    return (
      <Button variant="primary" className={big} onClick={() => goTab('sessions')}>
        {action.label}
      </Button>
    )
  if (action.kind === 'needs')
    return (
      <Button variant="primary" className={big} onClick={() => document.getElementById('needs-you')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
        {action.label}
      </Button>
    )
  return (
    <Button variant="primary" className={big} to={studyPath(studyId, screenById.R21)}>
      {action.label}
    </Button>
  )
}
