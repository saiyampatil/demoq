import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { cn } from '@/components/cn'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { StatusGlyph } from '@/components/StatusChip'
import type { StatusFamily } from '@/components/status'
import { SideDrawer } from '@/components/SideDrawer'
import { PageHeader } from '../../shared/PageHeader'
import { screenById, studyPath } from '@/routes/screens'
import { excerpt, liveExcerpts, type Excerpt } from '@/state/codebook'
import { tensionsOf } from '@/state/signals'
import { CODE_QUESTIONS } from '@/mock/codebook'
import { EXEC_SUMMARY_AI, FINDING_DRAFTS, QUESTION_IDS } from '@/mock/report'
import { uid } from '@/state/brief'
import {
  REPORT_USER,
  copyAIToResearcher,
  ensureReport,
  replaceAIDraft,
  saveSentence,
  setActive,
  strengthFor,
  updateReport,
  useReport,
  type Citation,
  type DraftKind,
  type ReportDoc,
  type Sentence,
  type Strength,
  type Target,
} from '@/state/report'
import { AnalysisStepper } from './AnalysisStepper'
import { useAnalysis } from './useAnalysis'

// ---------- small helpers ----------

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const questionLabel = (id: string) => CODE_QUESTIONS.find((q) => q.id === id)?.label ?? id
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const MINI = 'rounded-xs border border-mist bg-haze px-2 py-0.5 text-xs font-medium text-graphite hover:bg-paper disabled:opacity-50'
const MINI_ON = 'rounded-xs border border-ink bg-ink px-2 py-0.5 text-xs font-medium text-white'

const STRENGTH_STYLE: Record<Strength, { family: StatusFamily; cls: string }> = {
  Strong: { family: 'positive', cls: 'bg-positive-bg text-positive-fg border-positive-line' },
  Weak: { family: 'pending', cls: 'bg-pending-bg text-pending-fg border-pending-line' },
  Unanswered: { family: 'negative', cls: 'bg-negative-bg text-negative-fg border-negative-line' },
}

function StrengthChip({ strength }: { strength: Strength }) {
  const s = STRENGTH_STYLE[strength]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 text-xs font-medium', s.cls)}>
      <StatusGlyph family={s.family} />
      {strength}
    </span>
  )
}

// What a citation points at, once looked up in the codebook. null means it no longer matches anything.
type Resolved =
  | { kind: 'excerpt'; ex: Excerpt }
  | { kind: 'code'; name: string; definition: string; questionId: string; excerpts: Excerpt[] }
  | { kind: 'theme'; name: string; definition: string; codes: { name: string; excerpts: Excerpt[] }[] }
  | { kind: 'tension'; title: string; summary: string; type: string }
  | null

type Info = { strength: Strength; excerptCount: number; codeCount: number; asked: number; notAsked: number }
type Update = (fn: (r: ReportDoc) => ReportDoc) => void

// ---------- the screen ----------

export function Report() {
  const { studyId, study, review, accepted, doc, basis, stale, ready } = useAnalysis()
  const [params, setParams] = useSearchParams()
  const tab: 'findings' | 'exec' = params.get('tab') === 'exec' ? 'exec' : 'findings'
  const report = useReport(studyId)
  const [drawer, setDrawer] = useState<Citation | null>(null)

  // First visit: create the report from the pre-written AI drafts. Done in an effect, never during render.
  useEffect(() => {
    if (ready && doc && !report) {
      ensureReport(studyId, doc.builtOn, QUESTION_IDS, { exec: EXEC_SUMMARY_AI, findings: FINDING_DRAFTS })
    }
  }, [ready, doc, report, studyId])

  const resolve = useMemo(
    () =>
      (cit: Citation): Resolved => {
        if (!doc) return null
        switch (cit.kind) {
          case 'excerpt': {
            const ex = excerpt(cit.id)
            return ex ? { kind: 'excerpt', ex } : null
          }
          case 'code': {
            const code = doc.codes.find((c) => c.id === cit.id)
            return code ? { kind: 'code', name: code.name, definition: code.definition, questionId: code.questionId, excerpts: liveExcerpts(code, basis) } : null
          }
          case 'theme': {
            const theme = doc.themes.find((th) => th.id === cit.id)
            if (!theme) return null
            const codes = theme.codeIds.flatMap((id) => {
              const code = doc.codes.find((c) => c.id === id)
              return code ? [{ name: code.name, excerpts: liveExcerpts(code, basis) }] : []
            })
            return { kind: 'theme', name: theme.name, definition: theme.definition, codes }
          }
          case 'tension': {
            const tn = tensionsOf(doc, basis).find((x) => x.id === cit.id)
            return tn ? { kind: 'tension', title: tn.title, summary: tn.summary, type: tn.kind } : null
          }
        }
      },
    [doc, basis],
  )

  // Citations that don't match the codebook are listed in the browser console, so a wrong ID in the mock is easy to find.
  useEffect(() => {
    if (!report || !doc) return
    const missing = new Set<string>()
    const scan = (list: Sentence[]) => list.forEach((s) => s.cites.forEach((c) => { if (!resolve(c)) missing.add(`${c.kind}:${c.id}`) }))
    scan(report.execSummary.aiDraft)
    scan(report.execSummary.researcherDraft)
    report.findings.forEach((f) => { scan(f.aiDraft); scan(f.researcherDraft) })
    if (missing.size) console.warn('[Report] citations that do not match the codebook:', [...missing])
  }, [report, doc, resolve])

  const info = useMemo(() => {
    const map = new Map<string, Info>()
    if (!doc) return map
    for (const q of CODE_QUESTIONS) {
      const codes = doc.codes.filter((c) => c.questionId === q.id && c.status === 'Accepted')
      const excerptCount = codes.reduce((n, c) => n + liveExcerpts(c, basis).length, 0)
      const notAsked = q.skipped.length
      map.set(q.id, { strength: strengthFor(excerptCount, notAsked > 0), excerptCount, codeCount: codes.length, asked: accepted.length - notAsked, notAsked })
    }
    return map
  }, [doc, basis, accepted.length])

  const citeOptions = useMemo(() => {
    if (!doc) return { codes: [], themes: [], tensions: [] }
    return {
      codes: doc.codes.filter((c) => c.status === 'Accepted').map((c) => ({ id: c.id, label: c.name })),
      themes: doc.themes.map((th) => ({ id: th.id, label: th.name })),
      // A tension dismissed in Signals & tensions is never offered.
      tensions: tensionsOf(doc, basis)
        .filter((x) => String(doc.tensions?.[x.id]?.status) !== 'Dismissed')
        .map((x) => ({ id: x.id, label: x.title })),
    }
  }, [doc, basis])

  const goTab = (t: 'findings' | 'exec') =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (t === 'findings') next.delete('tab')
        else next.set('tab', t)
        return next
      },
      { replace: true },
    )

  if (!study) return null

  const header = (
    <>
      <PageHeader id="A3" title="Report" description="The story for the client: a finding for each guide question, backed by quotes, themes and clips. Nothing reaches the client until you publish." />
      <AnalysisStepper studyId={studyId} current="report" />
    </>
  )

  if (!ready || !doc) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="flex flex-col items-center rounded-md border border-dashed border-mist-strong bg-surface px-6 py-10 text-center">
          <p className="text-lg font-semibold text-ink">No accepted interviews yet</p>
          <p className="mt-2 text-sm text-graphite">Findings are written only from sessions accepted in Review, after the codebook is built.</p>
          <Link to={studyPath(studyId, screenById.A1)} className="mt-4 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white">
            Go to the codebook
          </Link>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p className="text-sm text-graphite" role="status">Preparing the report…</p>
      </div>
    )
  }

  const update: Update = (fn) => updateReport(studyId, fn)
  const excluded = review.filter((x) => x.status === 'Excluded').length
  const all = [...info.values()]
  const nStrong = all.filter((x) => x.strength === 'Strong').length
  const nWeak = all.filter((x) => x.strength === 'Weak').length
  const nUnanswered = all.filter((x) => x.strength === 'Unanswered').length
  const resolvedDrawer = drawer ? resolve(drawer) : null

  return (
    <div className="flex flex-col gap-6">
      {header}
      {stale && (
        <Banner
          tone="warning"
          title="Review changed after the codebook was built"
          actions={<Link to={studyPath(studyId, screenById.A1)} className="rounded-md border border-mist bg-surface px-3 py-1 text-sm font-medium text-ink">Update the codebook</Link>}
        >
          The counts below follow Review. Update the codebook so they match.
        </Banner>
      )}

      <div className="rounded-md border border-mist bg-surface p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold text-ink">Built on {plural(accepted.length, 'accepted session')}</span>
          {excluded > 0 && <span className="text-graphite">{excluded} excluded in Review {excluded === 1 ? 'is' : 'are'} left out.</span>}
          <span className="flex-1" />
          <span className="text-graphite">{nStrong} strong · {nWeak} weak · {nUnanswered} unanswered</span>
        </div>
      </div>

      <div className="flex gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'findings'} onClick={() => goTab('findings')} className={cn('rounded-md border px-3 py-1.5 text-sm', tab === 'findings' ? 'border-ink bg-ink text-white' : 'border-mist bg-haze text-graphite hover:bg-paper')}>
          Findings
        </button>
        <button type="button" role="tab" aria-selected={tab === 'exec'} onClick={() => goTab('exec')} className={cn('rounded-md border px-3 py-1.5 text-sm', tab === 'exec' ? 'border-ink bg-ink text-white' : 'border-mist bg-haze text-graphite hover:bg-paper')}>
          Executive summary
        </button>
      </div>

      {tab === 'exec' ? (
        <DraftCard
          title="Executive summary"
          subtitle="One narrative for the whole study, written against the approved discussion guide."
          target="exec"
          data={report.execSummary}
          regenSource={EXEC_SUMMARY_AI}
          resolve={resolve}
          onOpen={setDrawer}
          citeOptions={citeOptions}
          update={update}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {QUESTION_IDS.map((qId) => {
            const finding = report.findings.find((f) => f.questionId === qId)
            const i = info.get(qId)
            if (!finding || !i) return null
            const q = CODE_QUESTIONS.find((x) => x.id === qId)
            return (
              <DraftCard
                key={qId}
                title={questionLabel(qId)}
                subtitle={q?.text}
                meta={`${i.notAsked > 0 ? `Asked in ${i.asked} of ${accepted.length} accepted sessions` : `Asked in all ${accepted.length} accepted sessions`} · ${plural(i.excerptCount, 'excerpt')} from ${plural(i.codeCount, 'accepted code')}`}
                chip={<StrengthChip strength={i.strength} />}
                notes={
                  i.strength === 'Weak' ? (
                    <Banner tone="warning" title="Weak finding">
                      {i.excerptCount < 6
                        ? `Only ${plural(i.excerptCount, 'excerpt')} sit under accepted codes for this question.`
                        : `${plural(i.notAsked, 'accepted session')} were not asked this question, so the finding rests on ${i.asked}.`}{' '}
                      Read the quotes before you rely on it.
                    </Banner>
                  ) : i.strength === 'Unanswered' ? (
                    <Banner tone="danger" title="Unanswered">
                      {i.excerptCount === 0 ? 'No accepted codes cover this question yet.' : `Only ${plural(i.excerptCount, 'excerpt')} sit under accepted codes.`} There is no AI draft to
                      write from. Code this question in the codebook, or write the finding yourself.
                    </Banner>
                  ) : null
                }
                target={{ questionId: qId }}
                data={finding}
                regenSource={FINDING_DRAFTS[qId] ?? []}
                resolve={resolve}
                onOpen={setDrawer}
                citeOptions={citeOptions}
                update={update}
              />
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist pt-4">
        <Link to={studyPath(studyId, screenById.A2)} className="rounded-md border border-mist bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-haze">
          ← Signals &amp; tensions
        </Link>
        <span className="text-sm text-graphite">{nStrong} of {QUESTION_IDS.length} findings are strong. Publishing comes next.</span>
      </div>

      <SideDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer ? ({ excerpt: 'Quote', code: 'Code', theme: 'Theme', tension: 'Tension' } as const)[drawer.kind] : ''}
        description="Where this sentence comes from."
      >
        {drawer && <CitationDetail resolved={resolvedDrawer} />}
      </SideDrawer>
    </div>
  )
}

// ---------- citation drawer ----------

function ExcerptItem({ ex }: { ex: Excerpt }) {
  return (
    <li className="rounded-sm border border-mist px-3 py-2.5">
      <p className="font-serif leading-snug text-ink">“{ex.text}”</p>
      <p className="mt-1.5 text-xs text-graphite">
        Session {ex.sessionId} · {ex.participantId} · {mmss(ex.atSec)} · {questionLabel(ex.questionId)}
        {ex.corrected ? ' · corrected transcript' : ''}
      </p>
    </li>
  )
}

function CitationDetail({ resolved }: { resolved: Resolved }) {
  if (!resolved) {
    return <p className="text-sm text-graphite">This citation no longer matches anything in the codebook. It may have been rejected, merged or renamed. Replace it before you publish.</p>
  }
  if (resolved.kind === 'excerpt') {
    return <ul className="flex flex-col gap-2"><ExcerptItem ex={resolved.ex} /></ul>
  }
  if (resolved.kind === 'tension') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-graphite">{resolved.type}</p>
        <p className="font-semibold text-ink">{resolved.title}</p>
        <p className="text-sm text-ink">{resolved.summary}</p>
      </div>
    )
  }
  if (resolved.kind === 'code') {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-semibold text-ink">{resolved.name}</p>
          <p className="mt-1 text-sm text-graphite">{resolved.definition}</p>
          <p className="mt-1 text-xs text-graphite">Under: {questionLabel(resolved.questionId)}</p>
        </div>
        <p className="text-sm font-medium text-ink">{plural(resolved.excerpts.length, 'supporting quote')}</p>
        <ul className="flex flex-col gap-2">
          {resolved.excerpts.map((ex) => <ExcerptItem key={ex.id} ex={ex} />)}
        </ul>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-semibold text-ink">{resolved.name}</p>
        <p className="mt-1 text-sm text-graphite">{resolved.definition}</p>
      </div>
      {resolved.codes.map((code) => (
        <div key={code.name} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">{code.name} · {plural(code.excerpts.length, 'quote')}</p>
          <ul className="flex flex-col gap-2">
            {code.excerpts.map((ex) => <ExcerptItem key={ex.id} ex={ex} />)}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ---------- one card: AI draft and Researcher draft ----------

type CiteOptions = { codes: { id: string; label: string }[]; themes: { id: string; label: string }[]; tensions: { id: string; label: string }[] }

type DraftCardProps = {
  title: string
  subtitle?: string
  meta?: string
  chip?: ReactNode
  notes?: ReactNode
  target: Target
  data: { aiDraft: Sentence[]; researcherDraft: Sentence[]; active: DraftKind }
  regenSource: Sentence[]
  resolve: (c: Citation) => Resolved
  onOpen: (c: Citation) => void
  citeOptions: CiteOptions
  update: Update
}

function DraftCard({ title, subtitle, meta, chip, notes, target, data, regenSource, resolve, onOpen, citeOptions, update }: DraftCardProps) {
  const [view, setView] = useState<DraftKind>(data.active)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'copy' | 'regen' | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const by = REPORT_USER
  const hasResearcher = data.researcherDraft.some((s) => s.text.trim().length > 0)
  const uncited = data.researcherDraft.filter((s) => s.cites.length === 0).length

  const copyAI = () => {
    setConfirm(null)
    update((r) => copyAIToResearcher(r, target, { by }))
    setView('researcher')
  }
  const regenerate = () => {
    setConfirm(null)
    setRegenerating(true)
    timer.current = window.setTimeout(() => {
      update((r) => replaceAIDraft(r, target, regenSource.map((s) => ({ ...s, id: uid('s'), cites: [...s.cites] })), { by }))
      setRegenerating(false)
    }, 900)
  }

  return (
    <section className="flex flex-col gap-4 rounded-md border border-mist bg-surface p-5">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {chip}
          {uncited > 0 && <span className="rounded-xs border border-negative-line bg-negative-bg px-2 py-0.5 text-xs text-negative-fg">{uncited} uncited</span>}
        </div>
        {subtitle && <p className="text-sm text-graphite">{subtitle}</p>}
        {meta && <p className="text-xs text-graphite">{meta}</p>}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'ai'} onClick={() => setView('ai')} className={view === 'ai' ? MINI_ON : MINI}>
            AI draft{data.active === 'ai' ? ' · in the report' : ''}
          </button>
          <button type="button" role="tab" aria-selected={view === 'researcher'} onClick={() => setView('researcher')} className={view === 'researcher' ? MINI_ON : MINI}>
            Researcher draft{data.active === 'researcher' ? ' · in the report' : ''}
          </button>
        </div>
        <span className="flex-1" />
        {data.active !== view && (
          <button type="button" className={MINI} onClick={() => update((r) => setActive(r, target, view, { by }))}>
            Use this draft in the report
          </button>
        )}
      </div>

      {view === 'ai' ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AIGeneratedTag />
            <span className="text-sm font-semibold text-ink">PulseAI draft</span>
            {regenerating && <span className="text-xs text-graphite" role="status">Regenerating…</span>}
          </div>
          {data.aiDraft.length === 0 ? (
            <p className="rounded-md border border-dashed border-mist-strong px-4 py-5 text-sm text-graphite">No PulseAI draft. Nothing is coded under this question yet.</p>
          ) : (
            data.aiDraft.map((s) => <SentenceView key={s.id} sentence={s} resolve={resolve} onOpen={onOpen} />)
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={MINI}
              disabled={regenerating}
              onClick={() => (hasResearcher ? setConfirm('regen') : regenerate())}
            >
              Regenerate
            </button>
            <button
              type="button"
              className={MINI}
              disabled={data.aiDraft.length === 0}
              onClick={() => (hasResearcher ? setConfirm('copy') : copyAI())}
            >
              Use AI draft as starting point
            </button>
          </div>
          {confirm === 'regen' && (
            <Confirm text="Regenerating replaces the AI draft. Your researcher draft is kept." yes="Regenerate" onYes={regenerate} onNo={() => setConfirm(null)} />
          )}
          {confirm === 'copy' && (
            <Confirm text="This replaces your researcher draft with a copy of the AI draft." yes="Replace" onYes={copyAI} onNo={() => setConfirm(null)} />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink">Your draft</span>
          {data.researcherDraft.length === 0 && editingId === null && (
            <p className="rounded-md border border-dashed border-mist-strong px-4 py-5 text-sm text-graphite">
              No researcher draft yet. Start from the AI draft, or add a sentence of your own. Every sentence needs a citation before you publish.
            </p>
          )}
          {data.researcherDraft.map((s) =>
            editingId === s.id ? (
              <SentenceEditor
                key={s.id}
                initialText={s.text}
                initialCites={s.cites}
                options={citeOptions}
                resolve={resolve}
                onSave={(text, cites) => {
                  update((r) => saveSentence(r, target, s.id, { text, cites }, { by }))
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <SentenceView key={s.id} sentence={s} resolve={resolve} onOpen={onOpen} onEdit={() => setEditingId(s.id)} editDisabled={editingId !== null} />
            ),
          )}
          {editingId !== null && !data.researcherDraft.some((s) => s.id === editingId) && (
            <SentenceEditor
              initialText=""
              initialCites={[]}
              options={citeOptions}
              resolve={resolve}
              onSave={(text, cites) => {
                update((r) => saveSentence(r, target, editingId, { text, cites }, { by }))
                setEditingId(null)
              }}
              onCancel={() => setEditingId(null)}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={MINI} disabled={editingId !== null} onClick={() => setEditingId(uid('s'))}>
              Add a sentence
            </button>
            <button type="button" className={MINI} disabled={data.aiDraft.length === 0} onClick={() => (hasResearcher ? setConfirm('copy') : copyAI())}>
              Use AI draft as starting point
            </button>
          </div>
          {confirm === 'copy' && (
            <Confirm text="This replaces your researcher draft with a copy of the AI draft." yes="Replace" onYes={copyAI} onNo={() => setConfirm(null)} />
          )}
        </div>
      )}

      {notes}
    </section>
  )
}

function Confirm({ text, yes, onYes, onNo }: { text: string; yes: string; onYes: () => void; onNo: () => void }) {
  return (
    <div role="alertdialog" className="flex flex-wrap items-center gap-2 rounded-md border border-pending-line bg-pending-bg px-3 py-2 text-sm text-ink">
      <span className="flex-1">{text}</span>
      <button type="button" className={MINI} onClick={onYes}>{yes}</button>
      <button type="button" className={MINI} onClick={onNo}>Cancel</button>
    </div>
  )
}

// ---------- sentences ----------

function chipLabel(cit: Citation, resolved: Resolved): string {
  if (!resolved) return `${cit.kind} not found`
  switch (resolved.kind) {
    case 'excerpt':
      return `Quote · ${resolved.ex.participantId} · ${mmss(resolved.ex.atSec)}`
    case 'code':
      return `Code: ${resolved.name}`
    case 'theme':
      return `Theme: ${resolved.name}`
    case 'tension':
      return `Tension: ${resolved.title}`
  }
}

function CitationChips({ cites, resolve, onOpen, onRemove }: { cites: Citation[]; resolve: (c: Citation) => Resolved; onOpen?: (c: Citation) => void; onRemove?: (c: Citation) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {cites.map((cit) => {
        const resolved = resolve(cit)
        return (
          <span key={`${cit.kind}:${cit.id}`} className={cn('inline-flex items-center rounded-xs border text-xs', resolved ? 'border-mist text-graphite' : 'border-negative-line bg-negative-bg text-negative-fg')}>
            <button type="button" disabled={!onOpen} onClick={() => onOpen?.(cit)} className="px-2 py-0.5 hover:bg-haze disabled:hover:bg-transparent">
              {chipLabel(cit, resolved)}
            </button>
            {onRemove && (
              <button type="button" aria-label="Remove citation" onClick={() => onRemove(cit)} className="border-l border-mist px-1.5 py-0.5 hover:bg-haze">
                ×
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

function SentenceView({ sentence, resolve, onOpen, onEdit, editDisabled }: { sentence: Sentence; resolve: (c: Citation) => Resolved; onOpen: (c: Citation) => void; onEdit?: () => void; editDisabled?: boolean }) {
  const uncited = sentence.cites.length === 0
  return (
    <div className={cn('rounded-sm border px-3 py-2.5', uncited ? 'border-negative-line' : 'border-mist')}>
      <p className="leading-snug text-ink">{sentence.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {uncited ? <span className="rounded-xs border border-negative-line bg-negative-bg px-1.5 py-0.5 text-xs text-negative-fg">Uncited</span> : <CitationChips cites={sentence.cites} resolve={resolve} onOpen={onOpen} />}
        {onEdit && (
          <button type="button" className={cn(MINI, 'ml-auto')} onClick={onEdit} disabled={editDisabled}>
            Edit
          </button>
        )}
      </div>
    </div>
  )
}

function SentenceEditor({ initialText, initialCites, options, resolve, onSave, onCancel }: { initialText: string; initialCites: Citation[]; options: CiteOptions; resolve: (c: Citation) => Resolved; onSave: (text: string, cites: Citation[]) => void; onCancel: () => void }) {
  const [text, setText] = useState(initialText)
  const [cites, setCites] = useState<Citation[]>(initialCites)

  const add = (value: string) => {
    if (!value) return
    const [kind, ...rest] = value.split(':')
    const id = rest.join(':')
    if (cites.some((c) => c.kind === kind && c.id === id)) return
    setCites([...cites, { kind: kind as 'code' | 'theme' | 'tension', id }])
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-ink px-3 py-2.5">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="Sentence" className="w-full rounded-sm border border-mist bg-surface px-2 py-1.5 text-sm text-ink" autoFocus />
      <CitationChips cites={cites} resolve={resolve} onRemove={(c) => setCites(cites.filter((x) => !(x.kind === c.kind && x.id === c.id)))} />
      <select value="" onChange={(e) => add(e.target.value)} aria-label="Add a citation" className="w-full rounded-sm border border-mist bg-surface px-2 py-1 text-sm text-ink">
        <option value="">Add a citation…</option>
        {options.codes.length > 0 && (
          <optgroup label="Codes">
            {options.codes.map((o) => <option key={o.id} value={`code:${o.id}`}>{o.label}</option>)}
          </optgroup>
        )}
        {options.themes.length > 0 && (
          <optgroup label="Themes">
            {options.themes.map((o) => <option key={o.id} value={`theme:${o.id}`}>{o.label}</option>)}
          </optgroup>
        )}
        {options.tensions.length > 0 && (
          <optgroup label="Tensions">
            {options.tensions.map((o) => <option key={o.id} value={`tension:${o.id}`}>{o.label}</option>)}
          </optgroup>
        )}
      </select>
      <div className="flex items-center gap-2">
        <button type="button" className={MINI_ON} disabled={text.trim().length === 0} onClick={() => onSave(text.trim(), cites)}>
          Save
        </button>
        <button type="button" className={MINI} onClick={onCancel}>
          Cancel
        </button>
        {cites.length === 0 && <span className="text-xs text-negative-fg">No citation yet. It will show as uncited.</span>}
      </div>
    </div>
  )
}