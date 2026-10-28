import { cn } from '@/components/cn'
import { CheckIcon } from '@/components/icons'
import { SECTION_KEYS, sectionMeta, type SectionKey, type readiness } from '@/state/brief'
import { SectionStatusIcon, stateLabel } from './SectionStatusIcon'

type Readiness = ReturnType<typeof readiness>

const segmentClass = {
  ready: 'bg-positive-fg',
  review: 'bg-iris-300',
  missing: 'bg-pending-line',
  conflict: 'bg-negative-fg',
} as const

/** Always shown: the plain checklist of what blocks sharing. */
export function ShareChecklist({ ready }: { ready: Readiness }) {
  return (
    <div className="rounded-md border border-mist bg-surface p-4">
      <h2 className="text-sm font-semibold">Before you share</h2>
      {ready.canShare ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-positive-fg">
          <CheckIcon /> Ready to share with the client
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {ready.blockers.map((b) => (
            <li key={b} className="flex gap-2 text-ink">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-negative-fg" aria-hidden="true" />
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Recommended addition (flag: readinessPanel). Explains every section that isn't ready and why it matters. */
export function ReadinessPanel({ ready, onJump }: { ready: Readiness; onJump: (key: SectionKey) => void }) {
  const notReady = SECTION_KEYS.filter((k) => ready.states[k] !== 'ready')
  return (
    <div className="rounded-md border border-mist bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Brief readiness</h2>
        <span className="text-sm text-graphite tabular-nums">{ready.readyCount} of 7 ready</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {SECTION_KEYS.map((k) => (
          <span key={k} className={cn('h-1.5 flex-1 rounded-full', segmentClass[ready.states[k]])} />
        ))}
      </div>
      <p className={cn('mt-3 text-sm', ready.canShare ? 'text-positive-fg' : 'text-ink')}>
        {ready.canShare
          ? 'You can share it now. Sections that aren’t ready go to the client as they are.'
          : `Sharing is blocked: ${ready.blockers[0].charAt(0).toLowerCase()}${ready.blockers[0].slice(1)}.`}
      </p>
      {notReady.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3 border-t border-mist pt-3">
          {notReady.map((k) => (
            <li key={k}>
              <button type="button" onClick={() => onJump(k)} className="flex w-full items-start gap-2 rounded-xs text-left hover:bg-haze">
                <span className="mt-0.5">
                  <SectionStatusIcon state={ready.states[k]} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {sectionMeta[k].title}: {stateLabel[ready.states[k]]}
                  </span>
                  <span className="block text-xs text-graphite">{sectionMeta[k].why}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
