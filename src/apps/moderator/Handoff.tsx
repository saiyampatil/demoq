import { SideDrawer } from '@/components/SideDrawer'
import { cn } from '@/components/cn'
import { coveredSections, REQUEST_REASON, type FieldworkDoc, type Session } from '@/state/fieldwork'

/**
 * What a moderator needs before taking a participant over from the AI: how far the AI got, what was shown, and the
 * conversation so far. Opens when they accept a live escalation, and from "Details" on a request.
 */
export function HandoffDrawer({ open, onClose, title, subtitle, doc, session, children }: { open: boolean; onClose: () => void; title: string; subtitle: string; doc: FieldworkDoc; session: Session; children?: React.ReactNode }) {
  const covered = coveredSections(doc, session)
  const shown = session.stimuli.filter((x) => x.result === 'Shown')
  const h = 'text-xs font-semibold tracking-wide text-graphite uppercase'
  return (
    <SideDrawer open={open} onClose={onClose} title={title} description={`${subtitle} · ${REQUEST_REASON}`}>
      <div className="flex flex-col gap-5 text-sm" data-testid="rq-drawer">
        {children}
        <section>
          <h3 className={h}>Sections the AI covered</h3>
          {covered.length === 0 ? (
            <p className="mt-1 text-graphite">None yet.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-0.5" data-testid="rq-covered">
              {covered.map((c) => (
                <li key={c.title}>
                  {c.title} <span className="tabular-nums text-graphite">({c.done} of {c.of} questions)</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className={h}>Stimuli shown</h3>
          <p className="mt-1" data-testid="rq-stimuli">
            {shown.length ? shown.map((x) => x.name).join(', ') : 'None shown yet.'}
          </p>
        </section>
        <section>
          <h3 className={h}>Transcript so far</h3>
          {session.transcript.length === 0 ? (
            <p className="mt-1 text-graphite">Nothing was said yet.</p>
          ) : (
            <ol className="mt-1 flex flex-col gap-2" data-testid="rq-transcript">
              {session.transcript.map((t, i) => (
                <li key={i}>
                  <span className={cn('text-xs font-semibold', t.ai ? 'text-iris-700' : 'text-ink')}>{t.ai ? 'AI' : t.speaker}</span>
                  <p>{t.text}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </SideDrawer>
  )
}
