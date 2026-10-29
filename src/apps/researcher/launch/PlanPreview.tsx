import { LockIcon } from '@/components/icons'
import type { StudyPlan } from '@/state/launch'

// Deliberately quiet: plain text on the page background, no inputs, no hover states, nothing that looks editable.
export function PlanPreview({ plan }: { plan: StudyPlan }) {
  const total = plan.sections.reduce((n, s) => n + s.minutes, 0) || 1
  return (
    <section aria-label="Study plan, read-only" className="border-t border-mist pt-4 text-sm text-graphite">
      <p className="flex items-center gap-1.5">
        <LockIcon size={12} />
        Read-only. To change this, edit the guide (creates a new version).
      </p>
      <p className="mt-2">
        {plan.mode === 'ai' ? 'AI moderator' : 'Human moderator'}: {plan.moderator}. {plan.language}. Target {plan.durationMin} min. {plan.mandatoryCount} core questions
        {plan.surveyCount ? `, ${plan.surveyCount} ${plan.surveyCount === 1 ? 'survey' : 'surveys'}` : ''}.
      </p>

      <div aria-hidden="true" className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        {plan.sections.map((s, i) => (
          <span key={i} className="h-full bg-mist-strong" style={{ width: `${(s.minutes / total) * 100}%` }} />
        ))}
      </div>

      <ol className="mt-4 flex flex-col gap-5">
        {plan.sections.map((s, i) => (
          <li key={i}>
            <div className="flex items-baseline gap-3">
              <span className="w-5 text-xs tabular-nums">{i + 1}</span>
              <h3 className="flex-1 text-base font-medium text-ink">{s.title}</h3>
              <span className="tabular-nums">{s.minutes} min</span>
            </div>
            <ul className="mt-1.5 ml-8 flex flex-col gap-2 border-l border-mist pl-4">
              {s.items.map((q) => {
                const meta = [
                  q.core ? 'Core' : 'Secondary',
                  `${q.probes} ${q.probes === 1 ? 'probe' : 'probes'}`,
                  q.maxFollowUps !== null ? `max ${q.maxFollowUps} follow-ups` : null,
                  q.banned ? `${q.banned} banned ${q.banned === 1 ? 'phrase' : 'phrases'}` : null,
                  q.stimulus ? `shows ${q.stimulus}` : null,
                  q.survey ? `survey: ${q.survey}` : null,
                  q.branch ?? null,
                ].filter(Boolean)
                return (
                  <li key={q.id}>
                    <p className="text-ink">
                      <span className="mr-2 text-xs text-graphite tabular-nums">Q{q.n}</span>
                      {q.text}
                    </p>
                    <p className="text-xs">{meta.join(' · ')}</p>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>

      <div className="mt-5">
        <h3 className="text-base font-medium text-ink">Wrap-up conditions</h3>
        <ul className="mt-1 list-disc pl-5">
          {plan.wrapUp.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
