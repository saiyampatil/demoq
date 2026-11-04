import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { ChevronRightIcon } from '@/components/icons'
import { COVERAGE_FLAG_BELOW } from '@/config/coverage'
import { screenById, studyPath } from '@/routes/screens'
import type { FieldworkDoc } from '@/state/fieldwork'
import { topicCoverage } from '@/state/selectors'

const sessionsFor = (studyId: string, ids: string[], about: string) => `${studyPath(studyId, screenById.R18)}?${new URLSearchParams({ tab: 'sessions', ids: ids.join(','), about })}`

/**
 * Did the interviews get what the study needs? Per topic of the guide, how many finished interviews answered all of its
 * mandatory questions. It is about quality, where the cards above are about quantity. Open when something is missing,
 * a quiet one-line summary when everything is covered. Hidden until an interview has finished.
 */
export function CoverageCard({ doc, studyId }: { doc: FieldworkDoc; studyId: string }) {
  const c = topicCoverage(doc)
  if (c.interviews === 0 || c.topics.length === 0) return null
  const summary =
    c.gaps.length === 0
      ? `All ${c.topics.length} ${c.topics.length === 1 ? 'topic' : 'topics'} covered in every finished interview.`
      : c.flagged.length > 0
        ? `${c.flagged.length} ${c.flagged.length === 1 ? 'topic is' : 'topics are'} below ${Math.round(COVERAGE_FLAG_BELOW * 100)}%.`
        : `${c.gaps.length} ${c.gaps.length === 1 ? 'topic is' : 'topics are'} missing in a few interviews.`

  return (
    <details data-testid="coverage" open={c.gaps.length > 0} className="group rounded-md border border-mist bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon size={14} className="shrink-0 text-graphite transition-transform group-open:rotate-90" />
        <h2 className="text-md font-semibold">Topic coverage</h2>
        <span className="text-sm text-graphite" data-testid="coverage-summary">
          {summary}
        </span>
      </summary>
      <ul className="divide-y divide-mist border-t border-mist">
        {[...c.topics].sort((a, b) => a.share - b.share).map((t) => {
          const low = t.share < COVERAGE_FLAG_BELOW
          return (
            <li key={t.title} data-testid="coverage-row" data-low={low || undefined} className="grid items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_5.5rem_7.5rem]">
              <span className={cn('min-w-0 truncate text-sm', low ? 'font-medium text-ink' : 'text-ink')}>{t.title}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-haze" aria-hidden>
                <span className={cn('block h-full rounded-full', low ? 'bg-ink' : 'bg-mist-strong')} style={{ width: `${Math.round(t.share * 100)}%` }} />
              </span>
              <span className="text-sm tabular-nums text-graphite sm:text-right">
                {t.covered} of {t.interviews}
              </span>
              <span className="text-sm sm:text-right">
                {t.missed.length > 0 && (
                  <Link to={sessionsFor(studyId, t.missed, `missed “${t.title}”`)} className="font-medium text-iris-700 hover:underline tabular-nums">
                    View {t.missed.length}
                  </Link>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </details>
  )
}
