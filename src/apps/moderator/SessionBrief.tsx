import { Banner } from '@/components/Banner'
import { StimulusThumb } from '@/components/StimulusThumb'
import type { BriefDoc } from '@/state/brief'
import type { FieldworkDoc, Session } from '@/state/fieldwork'
import type { GuideDoc, Stimulus } from '@/state/guide'

/** The stimuli a participant sees, in their assigned order. A session with no plan sees them in the guide's order. Never the plans of anyone else. */
export function stimuliFor(doc: FieldworkDoc, session: Session, guide?: GuideDoc): { name: string; item?: Stimulus }[] {
  const names = session.stimulusPlan ? session.stimulusPlan.names : [...new Set(doc.plan.sections.flatMap((s) => s.items.map((i) => i.stimulus)).filter((x): x is string => !!x))]
  return names.map((name) => ({ name, item: guide?.stimuli.items.find((i) => i.name === name) })).filter((s) => s.item?.kind !== 'survey')
}

/**
 * What a human moderator reads before a session: the objective in plain words, the guide with its questions, probes and
 * time, the must-cover items, and what this participant will be shown, in order. Read only. It never carries screener
 * answers, criteria, the balance table or anyone else's plan, so the live console can embed it as it is.
 */
export function SessionBrief({ doc, session, guide, brief }: { doc: FieldworkDoc; session: Session; guide?: GuideDoc; brief?: BriefDoc }) {
  const plan = doc.plan
  const objective = brief?.draft?.objective.text?.trim()
  const questions = new Map((guide?.guide?.sections ?? []).flatMap((s) => s.questions).map((q) => [q.id, q]))
  const shown = stimuliFor(doc, session, guide)
  const since = session.bookedGuide !== undefined && session.bookedGuide < plan.guideVersion
  const must = plan.sections.flatMap((s) => s.items.filter((i) => i.core).map((i) => i.text))
  const h = 'text-xs font-semibold tracking-wide text-graphite uppercase'
  return (
    <div className="flex flex-col gap-6 text-sm" data-testid="session-brief">
      {since && (
        <div data-testid="guide-updated">
          <Banner tone="info" title={`Guide updated to version ${plan.guideVersion}`}>
            You booked this under version {session.bookedGuide}. What you see below is version {plan.guideVersion}.
          </Banner>
        </div>
      )}

      <section>
        <h2 className={h}>What this study is about</h2>
        <p className="mt-1 max-w-prose text-base" data-testid="brief-objective">
          {objective || 'The Researcher hasn’t written the objective down yet.'}
        </p>
        <p className="mt-2 text-xs text-graphite tabular-nums" data-testid="brief-version">
          Guide version {plan.guideVersion} · {plan.durationMin} minutes · {plan.language}
        </p>
      </section>

      {must.length > 0 && (
        <section>
          <h2 className={h}>Must cover</h2>
          <ul className="mt-1 list-disc pl-5" data-testid="brief-must">
            {must.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className={h}>Your participant sees</h2>
        {shown.length === 0 ? (
          <p className="mt-1 text-graphite" data-testid="brief-stimuli">No stimuli in this interview.</p>
        ) : (
          <ol className="mt-2 flex flex-wrap gap-3" data-testid="brief-stimuli">
            {shown.map((s, i) => (
              <li key={s.name} data-stimulus={s.name} className="flex flex-col gap-1">
                <StimulusThumb name={s.name} kind={s.item?.kind} />
                <span className="text-xs text-graphite tabular-nums">{i + 1}. {s.name}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={h}>The guide</h2>
        {plan.sections.map((sec, n) => (
          <div key={sec.title} className="rounded-md border border-mist bg-surface" data-testid="brief-section">
            <header className="flex items-baseline gap-3 border-b border-mist px-4 py-2.5">
              <h3 className="flex-1 font-semibold">
                {n + 1}. {sec.title}
              </h3>
              <span className="text-xs text-graphite tabular-nums">{sec.minutes} min</span>
            </header>
            <ol className="divide-y divide-mist">
              {sec.items.map((i) => {
                const probes = questions.get(i.id)?.probes.filter((p) => p.trim()) ?? []
                return (
                  <li key={i.id} className="px-4 py-2.5" data-testid="brief-question">
                    <p>
                      <span className="text-graphite tabular-nums">Q{i.n}. </span>
                      {i.text}
                      {i.core && <span className="ml-2 rounded-xs border border-mist-strong px-1.5 py-0.5 text-xs text-graphite">Must cover</span>}
                    </p>
                    {i.stimulus && <p className="mt-0.5 text-xs text-graphite">Shows: {i.stimulus}</p>}
                    {i.survey && <p className="mt-0.5 text-xs text-graphite">Survey: {i.survey}</p>}
                    {probes.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-graphite">
                        {probes.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </section>
    </div>
  )
}
