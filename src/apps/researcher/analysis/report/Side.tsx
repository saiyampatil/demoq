import { useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { screenById, studyPath } from '@/routes/screens'
import { formatDateTime } from '@/lib/format'
import { counts } from '@/state/codebook'
import { tensionCounts } from '@/state/signals'
import { plural, quotesOf, resolveCitation, type Resolved, type SentenceInfo } from '@/state/reportLogic'
import { LABEL, MINI, NumberText, QuoteCard, StateChip, StrengthChip, useWs } from './ws'

// ─── Built from your analysis ───────────────────────────────────────────────

function Row({ to, title, line, open }: { to: string; title: string; line: string; open?: string }) {
  return (
    <li>
      <Link to={to} className="flex flex-col gap-0.5 rounded-sm px-2.5 py-2 hover:bg-haze">
        <span className="flex items-center justify-between gap-2 text-sm font-medium text-ink">
          {title}
          <span className="text-xs font-normal text-graphite" aria-hidden="true">Open →</span>
        </span>
        <span className="text-xs text-graphite">{line}</span>
        {open && <span className="text-xs font-medium text-pending-fg" data-testid="still-open">{open}</span>}
      </Link>
    </li>
  )
}

/** Where the report comes from, with a way back to each step and what is still open there. */
export function BuiltFrom({ underReview }: { underReview: number }) {
  const { studyId, doc, model, accepted, excluded } = useWs()
  const c = counts(doc)
  const t = tensionCounts(doc)
  const ticked = model.findings.reduce((n, f) => n + f.signals.length, 0)
  return (
    <section aria-label="Built from your analysis" data-testid="built-from" className="rounded-md border border-mist bg-surface p-2">
      <h2 className={cn(LABEL, 'px-2.5 pt-1.5 pb-1')}>Built from your analysis</h2>
      <ul>
        <Row to={studyPath(studyId, screenById.A1)} title="Codebook" line={`${plural(c.accepted, 'accepted code')} · ${plural(doc.themes.filter((th) => !th.tensionId).length, 'theme')}`} open={c.suggested ? `${plural(c.suggested, 'code')} still to review` : undefined} />
        <Row to={studyPath(studyId, screenById.A2)} title="Emotion & behaviour" line={`${plural(ticked, 'signal')} ticked for findings · ${plural(t.themes, 'tension')} in the report`} open={t.toReview ? `${plural(t.toReview, 'tension')} still to decide` : undefined} />
        <Row to={studyPath(studyId, screenById.R21)} title="Review" line={`${accepted} accepted · ${excluded} excluded and left out`} open={underReview ? `${plural(underReview, 'session')} still under review` : undefined} />
      </ul>
    </section>
  )
}

// ─── Selected ───────────────────────────────────────────────────────────────

export function CitationBlock({ r, label }: { r: Resolved; label: string }) {
  const [all, setAll] = useState(false)
  if (r.kind === 'broken') {
    return (
      <li className="rounded-sm border border-negative-line bg-negative-bg px-3 py-2 text-xs text-negative-fg" data-testid="broken-cite">
        {label}: {r.why}
      </li>
    )
  }
  if (r.kind === 'tension') {
    const head = r.tension.sides[r.tension.sides.length - 1]
    return (
      <li className="rounded-sm border border-mist px-3 py-2 text-sm">
        <p className="text-xs text-graphite">Tension · {r.tension.kind}</p>
        <p className="font-medium text-ink">{r.tension.title}</p>
        <p className="mt-0.5 text-xs text-graphite">{r.tension.summary}</p>
        {head && <p className="mt-1 text-xs text-graphite"><b className="font-semibold text-ink tabular-nums">{head.n} of {head.of}</b> people · {head.label}</p>}
      </li>
    )
  }
  const quotes = quotesOf(r)
  const shown = all ? quotes : quotes.slice(0, 3)
  const head = r.kind === 'code' ? `${r.code.name} · ${r.people} of ${r.of} people` : r.kind === 'theme' ? `${r.theme.name} · ${r.people} of ${r.of} people` : 'Quote'
  return (
    <li className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-ink">{head}</p>
      {r.kind !== 'excerpt' && <p className="text-xs text-graphite">{r.kind === 'code' ? r.code.definition : r.theme.definition}</p>}
      <ul className="flex flex-col gap-1.5">{shown.map((ex) => <QuoteCard key={ex.id} ex={ex} compact />)}</ul>
      {quotes.length > 3 && (
        <button type="button" className={cn(MINI, 'self-start')} onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer quotes' : `Show all ${quotes.length} quotes`}
        </button>
      )}
    </li>
  )
}

const TOKEN_IDS = /\{(?:n|of):([\w-]+)\}/g

function SentenceDetail({ info }: { info: SentenceInfo }) {
  const { ctx, doc } = useWs()
  const ids = [...new Set([...(info.sentence.template ?? '').matchAll(TOKEN_IDS)].map((m) => m[1]))]
  const nameOf = (id: string) => doc.codes.find((c) => c.id === id)?.name ?? doc.themes.find((t) => t.id === id)?.name ?? id
  const a = info.approval
  return (
    <div className="flex flex-col gap-3" data-testid="selected-sentence">
      <div className="flex flex-col gap-1.5">
        <StateChip state={info.state} />
        <p className="leading-snug text-ink">
          <NumberText text={info.sentence.text} />
        </p>
      </div>
      {ids.length > 0 && (
        <div>
          <p className={LABEL}>Where the numbers come from</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-graphite">
            {ids.map((id) => {
              const v = ctx && resolveCitation({ kind: doc.codes.some((c) => c.id === id) ? 'code' : 'theme', id }, ctx)
              return (
                <li key={id}>
                  <span className="text-ink">{nameOf(id)}</span>: {v && (v.kind === 'code' || v.kind === 'theme') ? `${v.people} of ${v.of} people` : 'no longer counts'}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div>
        <p className={LABEL}>Built on</p>
        {info.cites.length === 0 ? (
          <p className="mt-1 text-sm text-negative-fg">No citation. It needs one, or a reason, before it can be approved.</p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-3">
            {info.cites.map(({ cit, resolved }) => (
              <CitationBlock key={`${cit.kind}:${cit.id}`} r={resolved} label={cit.kind} />
            ))}
          </ul>
        )}
      </div>
      {a && (
        <p className="text-xs text-graphite" data-testid="approval-record">
          Approved by {a.by} on {formatDateTime(a.at)} for report version {a.version}.
        </p>
      )}
    </div>
  )
}

/** Follows the selection in the report: what a sentence, a finding or a theme is built from, with the real quotes. */
export function Selected() {
  const { sel, model, doc, ctx, accepted } = useWs()
  let body: React.ReactNode = <p className="text-sm text-graphite">Select a sentence, a finding or a theme to see what it is built from: the codes, the people and the quotes, each with its session and timestamp.</p>

  if (sel?.kind === 'sentence') {
    const info = [...model.exec.sentences, ...model.findings.flatMap((f) => f.sentences)].find((s) => s.sentence.id === sel.id)
    if (info) body = <SentenceDetail info={info} />
  } else if (sel?.kind === 'finding') {
    const f = model.findings.find((x) => x.questionId === sel.qId)
    if (f)
      body = (
        <div className="flex flex-col gap-3" data-testid="selected-finding">
          <div>
            <p className="font-medium text-ink">{f.label}</p>
            <p className="mt-0.5 text-xs text-graphite">{f.text}</p>
            <div className="mt-1.5"><StrengthChip strength={f.strength} /></div>
          </div>
          <div>
            <p className={LABEL}>Accepted codes under it</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-sm">
              {f.codes.length === 0 && <li className="text-graphite">None yet.</li>}
              {f.codes.map((c) => {
                const r = resolveCitation({ kind: 'code', id: c.id }, ctx)
                return (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="text-ink">{c.name}</span>
                    <span className="tabular-nums text-graphite">{r.kind === 'code' ? `${r.people} of ${r.of}` : ''}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          {f.quotes.length > 0 && <ul className="flex flex-col gap-1.5">{f.quotes.map((q) => <QuoteCard key={q.excerpt.id} ex={q.excerpt} codeName={q.codeName} compact />)}</ul>}
        </div>
      )
  } else if (sel?.kind === 'theme') {
    const t = model.themes.find((x) => x.theme.id === sel.id)
    if (t)
      body = (
        <div className="flex flex-col gap-3" data-testid="selected-theme">
          <div>
            <p className="font-medium text-ink">{t.theme.name}</p>
            <p className="mt-0.5 text-xs text-graphite">{t.theme.definition}</p>
            <p className="mt-1 text-sm tabular-nums text-ink"><b className="font-semibold">{t.numbers?.n} of {t.numbers?.of}</b> people</p>
          </div>
          {t.note && <p className="text-xs text-graphite">{t.note}</p>}
          <ul className="flex flex-col gap-3">
            {t.codes.slice(0, 4).map((c) => {
              const r = resolveCitation({ kind: 'code', id: c.id }, ctx)
              return <CitationBlock key={c.id} r={r} label="code" />
            })}
          </ul>
          {t.fromTension && <p className="text-xs text-graphite">A theme made from a tension in Emotion &amp; behaviour. It counts that tension’s own finding.</p>}
        </div>
      )
  } else if (sel?.kind === 'exec') {
    const cited = new Map<string, number>()
    model.exec.sentences.forEach((s) => s.cites.forEach(({ cit }) => cited.set(`${cit.kind}:${cit.id}`, (cited.get(`${cit.kind}:${cit.id}`) ?? 0) + 1)))
    body = (
      <div className="flex flex-col gap-2" data-testid="selected-exec">
        <p className="text-sm text-ink">The executive summary is built from {plural(model.exec.sentences.length, 'sentence')} on {accepted} accepted sessions.</p>
        <ul className="flex flex-col gap-1 text-sm">
          {[...cited.keys()].map((key) => {
            const [kind, ...rest] = key.split(':')
            const id = rest.join(':')
            const name = doc.codes.find((c) => c.id === id)?.name ?? doc.themes.find((t) => t.id === id)?.name ?? id
            return <li key={key} className="text-graphite"><span className="text-xs">{kind}</span> · <span className="text-ink">{name}</span></li>
          })}
        </ul>
      </div>
    )
  }

  return (
    <section aria-label="Selected" data-testid="selected" className="rounded-md border border-mist bg-surface p-4">
      <h2 className={cn(LABEL, 'mb-2')}>Selected</h2>
      {body}
    </section>
  )
}
