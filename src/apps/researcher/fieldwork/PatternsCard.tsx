import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { ChevronRightIcon } from '@/components/icons'
import { INSIGHTS_MIN_INTERVIEWS } from '@/config/insights'
import { emergingPatterns } from '@/mock/insights'
import { screenById, studyPath } from '@/routes/screens'
import type { FieldworkDoc } from '@/state/fieldwork'
import { countedSessions } from '@/state/selectors'

const sessionsFor = (studyId: string, ids: string[], about: string) => `${studyPath(studyId, screenById.R18)}?${new URLSearchParams({ tab: 'sessions', ids: ids.join(','), about })}`

/**
 * What the finished interviews are starting to say. Apart from the alerts above it, tagged AI-generated, never final
 * and never a trigger for anything: a Researcher reads it and decides. Collapsed to one line until opened. Every pattern
 * opens the interviews behind it, so it can be checked. Hidden until enough interviews have finished.
 */
export function PatternsCard({ doc, studyId }: { doc: FieldworkDoc; studyId: string }) {
  const people = [...new Set(countedSessions(doc).map((s) => s.participantId))]
  if (people.length < INSIGHTS_MIN_INTERVIEWS) return null
  const patterns = emergingPatterns(studyId, people)
  if (patterns.length === 0) return null

  return (
    <details data-testid="patterns" className="group rounded-md border border-mist bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon size={14} className="shrink-0 text-graphite transition-transform group-open:rotate-90" />
        <h2 className="text-md font-semibold">Emerging patterns</h2>
        <AIGeneratedTag />
        <span className="text-sm text-graphite tabular-nums">
          {patterns.length} patterns from {people.length} interviews
        </span>
      </summary>
      <ul className="divide-y divide-mist border-t border-mist">
        {patterns.map((p) => (
          <li key={p.id} data-testid="pattern" className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="min-w-0">
              <p className="font-medium text-ink">{p.title}</p>
              <p className="mt-0.5 text-sm text-graphite">{p.summary}</p>
              <p className="mt-2 border-l-2 border-mist-strong pl-3 text-sm text-graphite italic">“{p.quote}”</p>
            </div>
            <div className="flex flex-col gap-1.5 sm:items-end sm:text-right">
              <span className="text-sm tabular-nums text-ink">
                {p.people.length} of {people.length}
              </span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-haze sm:w-28" aria-hidden>
                <span className="block h-full rounded-full bg-mist-strong" style={{ width: `${Math.round((p.people.length / people.length) * 100)}%` }} />
              </span>
              <Link to={sessionsFor(studyId, p.people, p.title)} className="text-sm font-medium text-iris-700 hover:underline tabular-nums">
                View {p.people.length}
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-mist px-5 py-3 text-xs text-graphite">Suggestions only, from the finished interviews. Nothing changes unless you decide.</p>
    </details>
  )
}
