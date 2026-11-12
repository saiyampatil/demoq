import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { cn } from '@/components/cn'
import { DiffText } from '@/components/DiffText'
import { ChevronRightIcon } from '@/components/icons'
import { screenById, studyPath } from '@/routes/screens'
import { uid } from '@/state/brief'
import type { Citation, DraftKind, Target } from '@/state/report'
import { hasTokens, plural, renderTemplate, resolveCitation, type FindingModel, type SentenceInfo, type ThemeModel } from '@/state/reportLogic'
import type { Tension } from '@/state/signals'
import { CitationChips, LABEL, MINI, MINI_ON, NumberText, QuoteCard, StateChip, StrengthChip, targetOf, useWs } from './ws'

// ─── a sentence ─────────────────────────────────────────────────────────────

function ReasonField({ label, placeholder, yes, onYes, onNo }: { label: string; placeholder: string; yes: string; onYes: (why: string) => void; onNo: () => void }) {
  const [why, setWhy] = useState('')
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-sm border border-pending-line bg-pending-bg px-3 py-2" data-testid="reason-field">
      <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder={placeholder} aria-label={label} autoFocus className="min-w-48 flex-1 rounded-sm border border-mist bg-surface px-2 py-1 text-sm text-ink" />
      <button type="button" className={MINI_ON} disabled={!why.trim()} onClick={() => onYes(why.trim())}>
        {yes}
      </button>
      <button type="button" className={MINI} onClick={onNo}>
        Cancel
      </button>
    </div>
  )
}

function SentenceCard({ info, target, mine, onEdit, editDisabled, canEditAsMine }: { info: SentenceInfo; target: Target; mine: boolean; onEdit: () => void; editDisabled: boolean; canEditAsMine: boolean }) {
  const { act, sel, select } = useWs()
  const s = info.sentence
  const [asking, setAsking] = useState<'reason' | 'keep' | null>(null)
  const selected = sel?.kind === 'sentence' && sel.id === s.id
  const choose = () => select({ kind: 'sentence', id: s.id })

  return (
    <li
      id={`sentence-${s.id}`}
      data-testid="sentence"
      data-id={s.id}
      data-state={info.state}
      className={cn('rounded-sm border bg-surface px-3 py-2.5', selected ? 'border-ink ring-1 ring-ink' : info.state === 'No citation' ? 'border-negative-line' : 'border-mist')}
    >
      <div className="flex items-start gap-3">
        <button type="button" onClick={choose} aria-pressed={selected} className="min-w-0 flex-1 rounded-xs text-left leading-snug text-ink">
          <NumberText text={s.text} />
        </button>
        <StateChip state={info.state} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {info.cited || info.cites.length ? <CitationChips cites={info.cites} onOpen={choose} /> : <span className="rounded-xs border border-negative-line bg-negative-bg px-1.5 py-0.5 text-xs text-negative-fg">Uncited</span>}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {info.state === 'To review' && (
            <button type="button" className={MINI_ON} data-testid="approve" onClick={() => act.approve(s.id)}>
              Approve
            </button>
          )}
          {info.state === 'No citation' && (
            <button type="button" className={MINI_ON} data-testid="approve-reason" onClick={() => setAsking('reason')}>
              Approve with a reason…
            </button>
          )}
          {(info.state === 'Approved' || info.state === 'Approved without citation') && (
            <button type="button" className={MINI} onClick={() => act.withdraw(s.id)}>
              Withdraw approval
            </button>
          )}
          {mine && (
            <button type="button" className={MINI} onClick={onEdit} disabled={editDisabled} data-testid="edit-sentence">
              Edit
            </button>
          )}
          {!mine && canEditAsMine && (
            <button type="button" className={MINI} onClick={onEdit} data-testid="edit-as-mine" title="Copies the AI draft into your own draft so you can change it">
              Edit as mine
            </button>
          )}
        </span>
      </div>

      {info.state === 'Approved without citation' && info.approval?.reason && <p className="mt-2 text-xs text-graphite">Approved by {info.approval.by} without a citation: {info.approval.reason}</p>}
      {info.approval?.keptNumbers && <p className="mt-2 text-xs text-graphite">Numbers kept as written by {info.approval.by}: {info.approval.keptNumbers.why}</p>}
      {info.cites.some((c) => c.resolved.kind === 'broken') && (
        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-negative-fg">
          {info.cites.flatMap((c) => (c.resolved.kind === 'broken' ? [<li key={`${c.cit.kind}:${c.cit.id}`}>{c.resolved.why}</li>] : []))}
        </ul>
      )}

      {info.numbersChanged && (
        <div className="mt-2 rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm" data-testid="suggested-update">
          <p className="font-medium text-ink">Suggested update: the numbers changed</p>
          <p className="mt-1 leading-snug text-ink">
            <DiffText before={s.text} after={info.live} />
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" className={MINI_ON} data-testid="apply-update" onClick={() => act.applyUpdate(target, s.id, info.live)}>
              Update the numbers
            </button>
            <button type="button" className={MINI} onClick={() => setAsking('keep')}>
              Keep as written…
            </button>
          </div>
        </div>
      )}

      {asking === 'reason' && (
        <ReasonField
          label="Why approve without a citation"
          placeholder="Why does this need no citation?"
          yes="Approve"
          onYes={(why) => {
            act.approve(s.id, { reason: why })
            setAsking(null)
          }}
          onNo={() => setAsking(null)}
        />
      )}
      {asking === 'keep' && (
        <ReasonField
          label="Why keep the wording"
          placeholder="Why keep the old numbers?"
          yes="Keep and approve"
          onYes={(why) => {
            act.approve(s.id, { keptNumbers: { why, live: info.live } })
            setAsking(null)
          }}
          onNo={() => setAsking(null)}
        />
      )}
    </li>
  )
}

// ─── writing a sentence ─────────────────────────────────────────────────────

function SentenceEditor({ initial, onSave, onCancel }: { initial: { text: string; template?: string; cites: Citation[] }; onSave: (v: { text: string; template?: string; cites: Citation[] }) => void; onCancel: () => void }) {
  const { ctx, doc } = useWs()
  const [text, setText] = useState(initial.template ?? initial.text)
  const [cites, setCites] = useState<Citation[]>(initial.cites)
  const live = hasTokens(text) ? renderTemplate(text, ctx) : text

  const options = useMemo(
    () => ({
      codes: doc.codes.filter((c) => c.status === 'Accepted').map((c) => ({ id: c.id, label: c.name })),
      themes: doc.themes.map((t) => ({ id: t.id, label: t.name })),
    }),
    [doc],
  )
  const addCite = (value: string) => {
    if (!value) return
    const [kind, ...rest] = value.split(':')
    const id = rest.join(':')
    if (cites.some((c) => c.kind === kind && c.id === id)) return
    setCites([...cites, { kind: kind as 'code' | 'theme', id }])
  }
  const insert = (value: string) => {
    if (!value) return
    setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}{n:${value}} of {of:${value}}`)
    addCite(`${doc.codes.some((c) => c.id === value) ? 'code' : 'theme'}:${value}`)
  }
  const resolved = cites.map((cit) => ({ cit, resolved: resolveCitation(cit, ctx) }))

  return (
    <li className="flex flex-col gap-2 rounded-sm border border-ink bg-surface px-3 py-2.5" data-testid="sentence-editor">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="Sentence" className="w-full rounded-sm border border-mist bg-surface px-2 py-1.5 text-sm text-ink" autoFocus />
      {hasTokens(text) && (
        <p className="text-xs text-graphite">
          Reads as: <NumberText text={live} className="text-ink" />
        </p>
      )}
      <CitationChips cites={resolved} onRemove={(c) => setCites(cites.filter((x) => !(x.kind === c.kind && x.id === c.id)))} />
      <div className="flex flex-wrap gap-2">
        <select value="" onChange={(e) => addCite(e.target.value)} aria-label="Add a citation" className="min-w-0 flex-1 rounded-sm border border-mist bg-surface px-2 py-1 text-sm text-ink">
          <option value="">Add a citation…</option>
          <optgroup label="Codes">{options.codes.map((o) => <option key={o.id} value={`code:${o.id}`}>{o.label}</option>)}</optgroup>
          <optgroup label="Themes">{options.themes.map((o) => <option key={o.id} value={`theme:${o.id}`}>{o.label}</option>)}</optgroup>
        </select>
        <select value="" onChange={(e) => insert(e.target.value)} aria-label="Insert a live number" className="min-w-0 flex-1 rounded-sm border border-mist bg-surface px-2 py-1 text-sm text-ink">
          <option value="">Insert a live number…</option>
          <optgroup label="Codes">{options.codes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>
          <optgroup label="Themes">{options.themes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={MINI_ON}
          disabled={text.trim().length === 0}
          data-testid="save-sentence"
          onClick={() => {
            const t = text.trim()
            onSave({ text: hasTokens(t) ? renderTemplate(t, ctx) : t, ...(hasTokens(t) ? { template: t } : {}), cites })
          }}
        >
          Save
        </button>
        <button type="button" className={MINI} onClick={onCancel}>
          Cancel
        </button>
        {cites.length === 0 && <span className="text-xs text-negative-fg">No citation yet. It will need a reason to be approved.</span>}
      </div>
    </li>
  )
}

// ─── the AI draft | Mine switch and the sentences under it ──────────────────

function DraftBlock({ target, active, sentences, hasMine, aiCount }: { target: Target; active: DraftKind; sentences: SentenceInfo[]; hasMine: boolean; aiCount: number }) {
  const { act } = useWs()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const mine = active === 'researcher'
  const key = target === 'exec' ? 'exec' : target.questionId
  const pendingEdit = useRef<number | null>(null)

  // "Edit as mine" copies the AI draft, then opens the sentence at the same position once it exists.
  useEffect(() => {
    if (pendingEdit.current !== null && mine && sentences[pendingEdit.current]) {
      setEditingId(sentences[pendingEdit.current].sentence.id)
      pendingEdit.current = null
    }
  }, [mine, sentences])

  const switchTo = (kind: DraftKind) => {
    if (kind === active) return
    setEditingId(null)
    act.setActive(target, kind)
  }
  const editing = editingId !== null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Which draft goes in the report" className="inline-flex overflow-hidden rounded-xs border border-mist" data-testid="draft-switch">
          {(['ai', 'researcher'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={active === kind}
              data-testid={`draft-${kind}`}
              onClick={() => switchTo(kind)}
              className={cn('px-2.5 py-0.5 text-xs font-medium', active === kind ? 'bg-ink text-white' : 'bg-surface text-graphite hover:bg-haze')}
            >
              {kind === 'ai' ? 'AI draft' : 'Mine'}
            </button>
          ))}
        </div>
        {!mine && <AIGeneratedTag />}
        <span className="text-xs text-graphite">The {mine ? 'draft you wrote' : 'PulseAI draft'} is the one in the report.</span>
        {!mine && (
          <button type="button" className={cn(MINI, 'ml-auto')} onClick={() => act.regenerate(target)} disabled={act.regenerating === key || aiCount === 0} data-testid="regenerate">
            {act.regenerating === key ? 'Regenerating…' : 'Regenerate'}
          </button>
        )}
      </div>

      {sentences.length === 0 && !editing && (
        <div className="rounded-sm border border-dashed border-mist-strong px-4 py-4 text-sm text-graphite" data-testid="empty-draft">
          {mine ? (
            <>
              <p>You have no draft of your own for this yet.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className={MINI} disabled={aiCount === 0} onClick={() => act.startFromAI(target)}>
                  Start from the AI draft
                </button>
                <button type="button" className={MINI} onClick={() => setEditingId(uid('s'))}>
                  Add a sentence
                </button>
              </div>
            </>
          ) : (
            'PulseAI has no draft for this. Nothing accepted in the codebook covers it yet. Code it in the codebook, or write it yourself.'
          )}
        </div>
      )}

      {(sentences.length > 0 || editing) && (
        <ul className="flex flex-col gap-2">
          {sentences.map((info) =>
            editingId === info.sentence.id ? (
              <SentenceEditor
                key={info.sentence.id}
                initial={{ text: info.sentence.text, template: info.sentence.template, cites: info.sentence.cites }}
                onSave={(v) => {
                  act.save(target, info.sentence.id, v)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={info.sentence.id}>
                <SentenceCard
                  info={info}
                  target={target}
                  mine={mine}
                  editDisabled={editing}
                  canEditAsMine={!mine && !hasMine}
                  onEdit={() => {
                    if (mine) setEditingId(info.sentence.id)
                    else {
                      pendingEdit.current = sentences.indexOf(info)
                      act.startFromAI(target)
                    }
                  }}
                />
                {mine && confirmDelete === info.sentence.id && (
                  <div role="alertdialog" className="mt-1 flex items-center gap-2 rounded-sm border border-pending-line bg-pending-bg px-3 py-1.5 text-sm">
                    <span className="flex-1">Delete this sentence from your draft?</span>
                    <button type="button" className={MINI} onClick={() => (act.remove(target, info.sentence.id), setConfirmDelete(null))}>Delete</button>
                    <button type="button" className={MINI} onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                )}
                {mine && confirmDelete !== info.sentence.id && !editing && (
                  <button type="button" className="mt-0.5 text-xs text-graphite underline-offset-2 hover:underline" onClick={() => setConfirmDelete(info.sentence.id)}>
                    Delete sentence
                  </button>
                )}
              </div>
            ),
          )}
          {editingId !== null && !sentences.some((x) => x.sentence.id === editingId) && (
            <SentenceEditor
              initial={{ text: '', cites: [] }}
              onSave={(v) => {
                act.save(target, editingId, v)
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          )}
        </ul>
      )}
      {mine && sentences.length > 0 && !editing && (
        <div>
          <button type="button" className={MINI} onClick={() => setEditingId(uid('s'))}>
            Add a sentence
          </button>
        </div>
      )}
    </div>
  )
}

// ─── executive summary ──────────────────────────────────────────────────────

export function ExecCard() {
  const { model, report, sel, select } = useWs()
  const e = model.exec
  const approved = e.sentences.filter((s) => !s.open).length
  return (
    <section data-testid="exec-card" className={cn('flex flex-col gap-3 rounded-md border bg-surface p-5', sel?.kind === 'exec' ? 'border-ink' : 'border-mist')}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-ink">Executive summary</h2>
        <span className="text-xs text-graphite">{e.sentences.length ? `${approved} of ${plural(e.sentences.length, 'sentence')} approved` : 'No sentences'}</span>
        <button type="button" className={cn(MINI, 'ml-auto')} onClick={() => select({ kind: 'exec' })}>
          Show what it is built on
        </button>
      </header>
      <p className="text-sm text-graphite">One story for the whole study, written against the discussion guide.</p>
      <DraftBlock target="exec" active={e.active} sentences={e.sentences} hasMine={e.hasMine} aiCount={report.execSummary.aiDraft.length} />
    </section>
  )
}

// ─── tension from Emotion & behaviour ───────────────────────────────────────

function TensionCard({ t }: { t: Tension }) {
  const { act, studyId } = useWs()
  const [asking, setAsking] = useState(false)
  const inReport = t.status === 'Turned into a theme'
  const head = t.sides[t.sides.length - 1]
  return (
    <li data-testid="tension" data-status={t.status} className="rounded-sm border border-mist bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-graphite">{t.kind}</p>
          <p className="text-sm font-medium text-ink">{t.title}</p>
          {head && <p className="mt-0.5 text-xs text-graphite"><b className="font-semibold text-ink tabular-nums">{head.n} of {head.of}</b> people · {head.label}</p>}
        </div>
        <span className={cn('rounded-xs border px-2 py-0.5 text-xs font-medium', inReport ? 'border-positive-line bg-positive-bg text-positive-fg' : 'border-pending-line bg-pending-bg text-pending-fg')}>{inReport ? 'In the report as a theme' : 'To decide in Emotion & behaviour'}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Link to={`${studyPath(studyId, screenById.A2)}?tab=tensions`} className={MINI}>
          Open in Emotion &amp; behaviour
        </Link>
        <button type="button" className={MINI} onClick={() => setAsking(true)} data-testid="dismiss-tension">
          Dismiss…
        </button>
        <span className="text-xs text-graphite">Same decision as in Emotion &amp; behaviour. Dismissed tensions never reach the report.</span>
      </div>
      {asking && (
        <ReasonField
          label="Why dismiss this tension"
          placeholder="Why dismiss it?"
          yes="Dismiss"
          onYes={(why) => {
            act.dismissTension({ id: t.id, title: t.title }, why)
            setAsking(false)
          }}
          onNo={() => setAsking(false)}
        />
      )}
    </li>
  )
}

// ─── a finding ──────────────────────────────────────────────────────────────

function FindingCard({ f }: { f: FindingModel }) {
  const { act, report, sel, select, accepted } = useWs()
  const [asking, setAsking] = useState(false)
  const raw = report.findings.find((x) => x.questionId === f.questionId)!
  const selected = sel?.kind === 'finding' && sel.qId === f.questionId
  const approved = f.sentences.filter((s) => !s.open).length

  return (
    <article id={`finding-${f.questionId}`} data-testid="finding" data-q={f.questionId} data-strength={f.strength} data-omitted={!!f.omitted} className={cn('flex flex-col gap-3 rounded-md border bg-surface p-4', selected ? 'border-ink' : 'border-mist', f.omitted && 'opacity-80')}>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-ink">{f.label}</h3>
          <StrengthChip strength={f.strength} />
          <span className="text-xs text-graphite">{f.sentences.length ? `${approved} of ${plural(f.sentences.length, 'sentence')} approved` : ''}</span>
          <button type="button" className={cn(MINI, 'ml-auto')} onClick={() => select({ kind: 'finding', qId: f.questionId })}>
            Show what it is built on
          </button>
        </div>
        <p className="text-sm text-graphite">{f.text}</p>
        <p className="text-xs text-graphite">
          {f.notAsked > 0 ? `Asked in ${f.asked} of ${accepted} accepted sessions` : `Asked in all ${accepted} accepted sessions`} · {f.people === 0 ? 'nobody' : `${f.people} of ${f.asked} people`} said something coded under it
        </p>
      </header>

      {f.omitted ? (
        <div className="rounded-sm border border-dashed border-mist-strong px-4 py-3 text-sm text-graphite" data-testid="omitted">
          Left out of the report by {f.omitted.by}: {f.omitted.why}
          <button type="button" className={cn(MINI, 'ml-3')} onClick={() => act.include(f.questionId)}>
            Put back
          </button>
        </div>
      ) : (
        <>
          {f.strength === 'Weak' && (
            <p className="rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg">
              Weak: {f.people < 5 ? `only ${f.people} of ${f.asked} people said something coded under this question.` : `${plural(f.notAsked, 'person', 'people')} weren’t asked this question, so it rests on ${f.asked}.`} Read the quotes before you rely on it.
            </p>
          )}
          {f.strength === 'Unanswered' && (
            <p className="rounded-sm border border-negative-line bg-negative-bg px-3 py-2 text-sm text-negative-fg">
              Unanswered: {f.people === 0 ? 'no accepted codes cover this question yet.' : `only ${plural(f.people, 'person', 'people')} said something coded under it.`} Code it in the codebook, write the finding yourself, or leave it out.
            </p>
          )}

          <DraftBlock target={targetOf(f.questionId)} active={f.active} sentences={f.sentences} hasMine={f.hasMine} aiCount={raw.aiDraft.length} />

          {f.quotes.length > 0 && (
            <div>
              <p className={LABEL}>Two representative quotes</p>
              <ul className="mt-1.5 grid gap-2 md:grid-cols-2" data-testid="rep-quotes">
                {f.quotes.map((q) => (
                  <QuoteCard key={q.excerpt.id} ex={q.excerpt} codeName={q.codeName} compact />
                ))}
              </ul>
            </div>
          )}

          {f.signals.length > 0 && (
            <div data-testid="signals">
              <p className={LABEL}>Signals ticked in Emotion &amp; behaviour</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {f.signals.map((s) => (
                  <li key={s.codeId} className="rounded-sm border border-mist bg-paper px-3 py-2 text-sm">
                    <p className="font-medium text-ink">{s.codeName}</p>
                    <ul className="mt-0.5 flex flex-col gap-0.5 text-xs text-graphite">
                      {s.lines.map((l) => (
                        <li key={l.channel}>
                          <span className="font-medium text-ink">{l.channel}.</span> {l.text}
                          {l.emotionVoice && <span className="ml-1 text-muted">(off in the client version until cleared)</span>}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {f.tensions.length > 0 && (
            <div>
              <p className={LABEL}>Related tension</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {f.tensions.map((t) => (
                  <TensionCard key={t.id} t={t} />
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-mist pt-2">
            <button type="button" className="text-xs text-graphite underline-offset-2 hover:underline" onClick={() => setAsking(true)} data-testid="omit-finding">
              Leave this finding out of the report…
            </button>
          </div>
          {asking && (
            <ReasonField
              label="Why leave this finding out"
              placeholder="Why leave it out?"
              yes="Leave out"
              onYes={(why) => {
                act.omit(f.questionId, why)
                setAsking(false)
              }}
              onNo={() => setAsking(false)}
            />
          )}
        </>
      )}
    </article>
  )
}

// ─── a section of the guide ─────────────────────────────────────────────────

export function SectionRow({ label, findings, open, onToggle }: { label: string; findings: FindingModel[]; open: boolean; onToggle: () => void }) {
  const live = findings.filter((f) => !f.omitted)
  const sentences = live.flatMap((f) => f.sentences)
  const approved = sentences.filter((s) => !s.open).length
  const n = (k: string) => live.filter((f) => f.strength === k).length
  return (
    <section data-testid="section" aria-label={label} className="rounded-md border border-mist bg-surface">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper">
        <span className={cn('text-graphite transition-transform', open && 'rotate-90')}>
          <ChevronRightIcon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{label}</span>
          <span className="block text-xs text-graphite">
            {plural(findings.length, 'finding')} · {n('Strong')} strong, {n('Weak')} weak, {n('Unanswered')} unanswered
          </span>
        </span>
        <span className="text-xs text-graphite tabular-nums">{sentences.length ? `${approved} of ${sentences.length} approved` : 'Nothing to approve'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-mist bg-paper p-3">
          {findings.map((f) => (
            <FindingCard key={f.questionId} f={f} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── themes, compact ────────────────────────────────────────────────────────

export function ThemeRows({ themes, open, onToggle }: { themes: ThemeModel[]; open: boolean; onToggle: () => void }) {
  const { sel, select } = useWs()
  return (
    <section data-testid="themes" aria-label="Themes" className="rounded-md border border-mist bg-surface">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper">
        <span className={cn('text-graphite transition-transform', open && 'rotate-90')}>
          <ChevronRightIcon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">Themes</span>
          <span className="block text-xs text-graphite">{themes.length ? `${plural(themes.length, 'theme')} from the codebook and Emotion & behaviour` : 'No themes yet. Group accepted codes into a theme in the codebook.'}</span>
        </span>
      </button>
      {open && themes.length > 0 && (
        <ul className="flex flex-col divide-y divide-mist border-t border-mist">
          {themes.map((t) => {
            const selected = sel?.kind === 'theme' && sel.id === t.theme.id
            return (
              <li key={t.theme.id} data-testid="theme-row">
                <button type="button" onClick={() => select({ kind: 'theme', id: t.theme.id })} aria-pressed={selected} className={cn('flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-left hover:bg-paper', selected && 'bg-iris-50')}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{t.theme.name}</span>
                    {t.note && <span className="block text-xs text-graphite">{t.note}</span>}
                  </span>
                  {t.fromTension && <span className="rounded-xs border border-mist px-1.5 py-0.5 text-xs text-graphite">From a tension</span>}
                  <span className="text-sm tabular-nums text-ink">
                    {t.numbers?.n} of {t.numbers?.of} people
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
