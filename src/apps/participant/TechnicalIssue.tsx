import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { Button, Spinner } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { AlertIcon, CheckIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { MOISTURIZER_ID } from '@/mock/moisturizerStudy'
import { selfServiceFailed, selfServiceResolved, tick, type IssueType } from '@/state/fieldwork'
import { selfServiceFor, SELF_SERVICE } from '@/state/selfService'
import { useStudies } from '@/state/StudyContext'

type Phase = 'steps' | 'checking' | 'retry' | 'fixed' | 'handoff'
/** What the next re-check finds. Stands in for the real device check. */
type Finds = 'first' | 'retry' | 'never'

const FINDS: { value: Finds; label: string }[] = [
  { value: 'first', label: 'The first check passes' },
  { value: 'retry', label: 'It passes on the retry' },
  { value: 'never', label: 'It never passes' },
]

/** One thing the AI guide says. Simulated, so it carries the AI-generated tag. */
function Bubble({ children, tag = true }: { children: React.ReactNode; tag?: boolean }) {
  return (
    <div className="max-w-[92%] rounded-md rounded-tl-xs border border-mist bg-paper px-3.5 py-2.5 text-base">
      {children}
      {tag && (
        <div className="mt-1.5">
          <AIGeneratedTag />
        </div>
      )}
    </div>
  )
}

/**
 * P18: something stopped working mid-interview. Before the Researcher ever hears about it, an AI guide walks the
 * participant through the fix, one step at a time, and re-checks. If it works the interview resumes from the last saved
 * question and the Researcher is never involved (it is logged as happened and resolved). If it still doesn't work after
 * one retry the research team is told, and the session reaches Needs you with a note that self-service was tried.
 */
export function TechnicalIssue() {
  const { inviteId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { getFieldwork, updateFieldwork } = useStudies()
  const doc = getFieldwork(MOISTURIZER_ID)

  const issueParam = params.get('issue') ?? 'Microphone permission denied'
  const content = selfServiceFor(issueParam)
  const sessionId = params.get('session') ?? doc?.sessions.find((s) => s.status === 'Active')?.id ?? ''
  const session = doc?.sessions.find((s) => s.id === sessionId)
  const finds = (['first', 'retry', 'never'].includes(params.get('check') ?? '') ? params.get('check') : 'first') as Finds

  // A session that already went to the research team opens on that message; one that isn't running has nothing to fix.
  const alreadyTold = !!session && session.status === 'Technical Error' && session.issues.some((i) => i.status === 'Open' && i.type === issueParam && i.selfService === undefined) && !!session.selfService?.some((x) => x.outcome === 'unresolved' && x.issue === issueParam)
  const [phase, setPhase] = useState<Phase>(alreadyTold ? 'handoff' : 'steps')
  const [shown, setShown] = useState(1)
  const [checks, setChecks] = useState(0)
  const startedAt = useRef<string>('')
  const written = useRef(false)
  if (!startedAt.current && doc) startedAt.current = tick(doc)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const frame = (body: React.ReactNode, footer?: React.ReactNode) => (
    <>
      <main className="flex-1 px-4 py-6">{body}</main>
      {footer && <footer className="sticky bottom-0 border-t border-mist bg-surface px-4 py-3">{footer}</footer>}
    </>
  )

  if (!doc || !session || !content)
    return frame(
      <EmptyState
        className="px-2 py-8"
        title="We can’t find your interview"
        description="This link doesn’t match an interview that is running. Please open the link we sent you again."
      />,
    )
  if (session.status !== 'Active' && phase !== 'handoff' && phase !== 'fixed')
    return frame(<EmptyState className="px-2 py-8" title="Nothing to fix right now" description="Your interview isn’t running at the moment. If something went wrong, open your link again and we’ll take it from there." />)

  const type = content.type as IssueType
  const lastStep = shown >= content.steps.length

  const check = () => {
    const n = checks + 1
    setChecks(n)
    setPhase('checking')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const passes = finds === 'first' ? true : finds === 'retry' ? n >= 2 : false
      if (passes) {
        setPhase('fixed')
        if (!written.current) {
          written.current = true
          updateFieldwork(MOISTURIZER_ID, (d) => selfServiceResolved(d, session.id, type, n, startedAt.current))
        }
      } else if (n >= 2) {
        setPhase('handoff')
        if (!written.current) {
          written.current = true
          updateFieldwork(MOISTURIZER_ID, (d) => selfServiceFailed(d, session.id, type, n, startedAt.current))
        }
      } else setPhase('retry')
    }, 1200)
  }

  const body = (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Something’s not working</h1>
        <div role="alert" className="mt-3 flex gap-3 rounded-md border border-pending-line bg-pending-bg px-3.5 py-3">
          <AlertIcon size={18} className="mt-0.5 shrink-0 text-pending-fg" />
          <div>
            <p className="font-medium">{content.headline}</p>
            <p className="mt-0.5 text-sm">{content.plain}</p>
          </div>
        </div>
      </div>

      {/* The guide's side of the conversation. Each step appears when the one before is done. */}
      <div aria-live="polite" data-testid="guide" className="flex flex-col gap-3">
        <Bubble>{content.intro}</Bubble>
        {content.steps.slice(0, shown).map((s, i) => (
          <div key={s} className="flex flex-col gap-2">
            <Bubble tag={false}>
              <span className="mr-1.5 font-semibold">Step {i + 1}.</span>
              {s}
            </Bubble>
            {i === shown - 1 && !lastStep && phase === 'steps' && (
              <Button size="sm" className="h-10 self-start px-4" onClick={() => setShown(shown + 1)}>
                Done, what’s next?
              </Button>
            )}
          </div>
        ))}
        {lastStep && phase === 'steps' && <Bubble tag={false}>When you’ve done that, tap Try again and I’ll check.</Bubble>}
        {phase === 'checking' && (
          <Bubble tag={false}>
            <span className="flex items-center gap-2">
              <Spinner /> Checking…
            </span>
          </Bubble>
        )}
        {phase === 'retry' && (
          <Bubble>
            <span data-testid="retry-hint">That didn’t fix it yet. No problem, let’s try once more. {content.retryHint}</span>
          </Bubble>
        )}
        {phase === 'fixed' && (
          <>
            <Bubble>{content.fixed}</Bubble>
            <div role="status" className="flex gap-3 rounded-md border border-positive-line bg-positive-bg px-3.5 py-3">
              <CheckIcon size={18} className="mt-0.5 shrink-0 text-positive-fg" />
              <p className="text-sm">All fixed. Your interview picks up from your last saved question. Nothing is asked again.</p>
            </div>
          </>
        )}
        {phase === 'handoff' && (
          <div role="status" data-testid="handoff" className="rounded-md border border-mist-strong bg-paper px-3.5 py-3">
            <p className="font-medium">We’ve let the research team know</p>
            <p className="mt-1 text-sm text-graphite">Thanks for trying. Your answers so far are saved. Someone will get in touch with a link to carry on, so you don’t need to do anything else.</p>
          </div>
        )}
      </div>

      {import.meta.env.DEV && (
        <label className="flex flex-col gap-1 rounded-sm border border-dashed border-mist-strong px-3 py-2 text-xs text-graphite">
          Dev: what the check finds
          <select
            value={finds}
            onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); n.set('check', e.target.value); return n }, { replace: true })}
            className={cn(controlBase, 'h-9 text-sm text-ink')}
            aria-label="What the check finds"
          >
            {FINDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )

  const footer =
    phase === 'fixed' ? (
      <Button variant="primary" className="h-11 w-full" onClick={() => navigate(`/p/${inviteId}/interview`)}>
        Continue my interview
      </Button>
    ) : phase === 'handoff' ? undefined : (
      <Button variant="primary" className="h-11 w-full" disabled={phase === 'checking' || (phase === 'steps' && !lastStep)} onClick={check}>
        Try again
      </Button>
    )

  return frame(body, footer)
}

// Exported so the dev control on the session record lists the same problems.
export const SELF_SERVICE_TYPES = SELF_SERVICE.map((x) => x.type)
