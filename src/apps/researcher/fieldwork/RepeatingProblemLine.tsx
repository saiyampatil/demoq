import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { screenById, studyPath } from '@/routes/screens'
import type { FieldworkDoc } from '@/state/fieldwork'
import { repeatingProblems } from '@/state/selectors'

const sessionsFor = (studyId: string, types: string[]) => `${studyPath(studyId, screenById.R18)}?${new URLSearchParams({ tab: 'sessions', issue: types.join('|') })}`

/**
 * One line, only when the same problem has hit several different people. Not a record of issues (the session page has
 * that) and not a to-do (Needs you has that): it points at something to check in the study itself. Never more than one
 * line, and nothing at all when nothing repeats, while paused, or once fieldwork is closed.
 */
export function RepeatingProblemLine({ doc, studyId, behind, hidden }: { doc: FieldworkDoc; studyId: string; /** Fieldwork is behind pace: the only time this line takes amber. */ behind: boolean; hidden: boolean }) {
  const found = repeatingProblems(doc)
  if (hidden || found.length === 0) return null
  const [main, second] = found

  return (
    <p data-testid="repeating-problem" className={cn('flex items-start gap-2 text-sm', behind ? 'text-pending-fg' : 'text-ink')}>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0">
        <path d="M3 6.5V5.25A2.25 2.25 0 0 1 5.25 3H12m0 0-1.75-1.75M12 3l-1.75 1.75M13 9.5v1.25A2.25 2.25 0 0 1 10.75 13H4m0 0 1.75 1.75M4 13l1.75-1.75" />
      </svg>
      <span className="tabular-nums">
        <Link to={sessionsFor(studyId, main.types)} className="font-medium underline underline-offset-2 hover:no-underline">
          {main.label} for {main.people} people
        </Link>
        {second && (
          <>
            ,{' '}
            <Link to={sessionsFor(studyId, second.types)} data-testid="repeating-problem-other" className="underline underline-offset-2 hover:no-underline">
              and 1 other problem
            </Link>
          </>
        )}
        . {main.check}
      </span>
    </p>
  )
}
