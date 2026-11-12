import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { DiffText } from '@/components/DiffText'
import { CheckIcon, AlertIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { Studio } from '@/components/Studio'
import { Tooltip } from '@/components/Tooltip'
import { formatDateTime } from '@/lib/format'
import type { ReviewSession } from '@/mock/review'
import { screenById, studyPath } from '@/routes/screens'
import { plural, releaseChecks, blockers } from '@/state/reportLogic'
import { draftOf, type Target } from '@/state/report'
import { LABEL, MINI, MINI_ON, targetOf, useWs, type ToolKey } from './ws'

// ─── Compare AI and mine ────────────────────────────────────────────────────

const joined = (list: { text: string }[]) => list.map((s) => s.text).join(' ')

export function CompareStudio({ onClose }: { onClose: () => void }) {
  const { report, model, act } = useWs()
  const rows: { target: Target; label: string; key: string }[] = [
    { target: 'exec', label: 'Executive summary', key: 'exec' },
    ...model.findings.map((f) => ({ target: targetOf(f.questionId), label: f.label, key: f.questionId })),
  ]
  const draftsOf = (key: string) => (key === 'exec' ? report.execSummary : report.findings.find((f) => f.questionId === key)!)
  const withMine = rows.filter((r) => draftsOf(r.key).researcherDraft.length > 0)
  const differ = withMine.filter((r) => joined(draftsOf(r.key).aiDraft) !== joined(draftsOf(r.key).researcherDraft)).length
  const [confirm, setConfirm] = useState<string | null>(null)

  return (
    <Studio
      open
      id="compare"
      onClose={onClose}
      title="Compare AI and mine"
      description={`${withMine.length} of ${rows.length} sections have a draft of yours · ${differ} differ from the AI draft. The draft marked “in the report” is the one that is published.`}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <ul className="flex flex-col divide-y divide-mist">
        {rows.map((r) => {
          const d = draftsOf(r.key)
          const hasMine = d.researcherDraft.length > 0
          const same = hasMine && joined(d.aiDraft) === joined(d.researcherDraft)
          return (
            <li key={r.key} data-testid="compare-row" data-q={r.key} data-differs={hasMine && !same} className="flex flex-col gap-3 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{r.label}</h3>
                <span className="rounded-xs border border-mist px-1.5 py-0.5 text-xs text-graphite">{d.active === 'ai' ? 'AI draft in the report' : 'Mine in the report'}</span>
                {hasMine && <span className="text-xs text-graphite">{same ? 'Same as the AI draft' : 'Differs from the AI draft'}</span>}
              </div>
              {!hasMine ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-graphite">
                  <span>You have no draft of your own here. {d.aiDraft.length === 0 ? 'There is no AI draft either.' : ''}</span>
                  <button type="button" className={MINI} disabled={d.aiDraft.length === 0} onClick={() => act.startFromAI(r.target)}>
                    Start from the AI draft
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className={cn('rounded-sm border px-3 py-2.5', d.active === 'ai' ? 'border-ink' : 'border-mist')}>
                      <p className={LABEL}>AI draft</p>
                      <ul className="mt-1.5 flex flex-col gap-1.5 text-sm text-ink">{d.aiDraft.map((s) => <li key={s.id}>{s.text}</li>)}{d.aiDraft.length === 0 && <li className="text-graphite">Empty</li>}</ul>
                    </div>
                    <div className={cn('rounded-sm border px-3 py-2.5', d.active === 'researcher' ? 'border-ink' : 'border-mist')}>
                      <p className={LABEL}>Mine</p>
                      <ul className="mt-1.5 flex flex-col gap-1.5 text-sm text-ink">{d.researcherDraft.map((s) => <li key={s.id}>{s.text}</li>)}</ul>
                    </div>
                  </div>
                  {!same && (
                    <div className="rounded-sm border border-mist bg-paper px-3 py-2.5 text-sm" data-testid="compare-diff">
                      <p className={cn(LABEL, 'mb-1')}>What I changed</p>
                      <DiffText before={joined(d.aiDraft)} after={joined(d.researcherDraft)} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={d.active === 'ai' ? MINI_ON : MINI} aria-pressed={d.active === 'ai'} onClick={() => act.setActive(r.target, 'ai')}>
                      Use the AI draft
                    </button>
                    <button type="button" className={d.active === 'researcher' ? MINI_ON : MINI} aria-pressed={d.active === 'researcher'} onClick={() => act.setActive(r.target, 'researcher')} data-testid="use-mine">
                      Use mine
                    </button>
                    <button type="button" className={MINI} disabled={d.aiDraft.length === 0} onClick={() => setConfirm(r.key)}>
                      Replace mine with the AI draft…
                    </button>
                  </div>
                  {confirm === r.key && (
                    <div role="alertdialog" className="flex flex-wrap items-center gap-2 rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm">
                      <span className="flex-1">This replaces your draft with a copy of the AI draft. Your wording is lost.</span>
                      <button type="button" className={MINI} onClick={() => (act.startFromAI(r.target), setConfirm(null))}>Replace</button>
                      <button type="button" className={MINI} onClick={() => setConfirm(null)}>Cancel</button>
                    </div>
                  )}
                </>
              )}
              {hasMine && draftOf(d).length === 0 && <p className="text-xs text-negative-fg">The draft in the report has no sentences.</p>}
            </li>
          )
        })}
      </ul>
    </Studio>
  )
}

// ─── Release (the checklist; publishing and exports come next) ──────────────

export function ReleaseStudio({ onClose, onReview, stale }: { onClose: () => void; onReview: () => void; stale: boolean }) {
  const { model, studyId, excluded } = useWs()
  const checks = releaseChecks(model, { stale, excluded })
  const blocked = blockers(checks)
  const link = (to: NonNullable<(typeof checks)[number]['to']>) => {
    if (to === 'review') return <button type="button" className={MINI} onClick={onReview}>Review sentences</button>
    const path = to === 'A1' ? screenById.A1 : to === 'A2' ? screenById.A2 : screenById.R21
    return <Link to={studyPath(studyId, path)} className={MINI}>{to === 'Review' ? 'Open Review' : to === 'A1' ? 'Open the codebook' : 'Open Emotion & behaviour'}</Link>
  }
  return (
    <Studio
      open
      id="release"
      onClose={onClose}
      title="Publish"
      description="What has to be true before the client gets this report. Publishing freezes a version that never changes."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Tooltip content={blocked.length ? `${plural(blocked.length, 'check')} to clear first` : 'Publishing, the client preview and exports are built in the next step.'} align="right" focusable>
            <Button variant="primary" disabled data-testid="publish-v1">
              Publish version 1
            </Button>
          </Tooltip>
        </>
      }
    >
      <div className="flex flex-col gap-5 p-6">
        <p className={cn('rounded-sm border px-3 py-2 text-sm', blocked.length ? 'border-pending-line bg-pending-bg text-pending-fg' : 'border-positive-line bg-positive-bg text-positive-fg')} role="status" data-testid="release-verdict">
          {blocked.length ? `Not ready: ${plural(blocked.length, 'thing')} to clear before this can be published.` : 'Ready to publish. Every sentence is approved, cited and up to date.'}
        </p>
        <ul className="flex flex-col divide-y divide-mist rounded-md border border-mist" data-testid="release-checks">
          {checks.map((c) => (
            <li key={c.key} data-check={c.key} data-ok={c.ok} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', c.ok ? 'bg-positive-bg text-positive-fg' : c.blocks ? 'bg-negative-bg text-negative-fg' : 'bg-pending-bg text-pending-fg')} aria-hidden="true">
                {c.ok ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                  {c.label} <span className="sr-only">{c.ok ? '(done)' : c.blocks ? '(blocks publishing)' : '(advice)'}</span>
                </span>
                <span className="block text-xs text-graphite">{c.detail}</span>
              </span>
              {!c.ok && c.to && link(c.to)}
            </li>
          ))}
        </ul>
        <div className="rounded-md border border-mist bg-paper p-4 text-sm text-graphite">
          <p className="font-medium text-ink">What the client will and won’t see</p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
            <li>People appear as “Participant 7”, never as IDs.</li>
            <li>No drafts, flags or scores. No excluded sessions, dismissed tensions or unapproved codes.</li>
            <li>Emotion and voice signals are off by default in the client version until legal clears them.</li>
            <li>Every number is a count of people, “n of N”, and matches the codebook and Emotion &amp; behaviour.</li>
          </ul>
        </div>
      </div>
    </Studio>
  )
}

// ─── tools not built yet ────────────────────────────────────────────────────

const PLANNED: Record<string, { title: string; phase: string; text: string }> = {
  'theme-videos': { title: 'Theme videos', phase: 'A3-3', text: 'One short video per theme, cut from the quotes behind it, with the order and the clips yours to change.' },
  showreel: { title: 'Showreel', phase: 'A3-3', text: 'The main themes in one reel. Reorder, replace or remove clips before it goes to the client.' },
  'word-cloud': { title: 'Word cloud', phase: 'A3-4', text: 'The words people used most, counted in people, with the quotes behind each word.' },
  'theme-map': { title: 'Theme map', phase: 'A3-4', text: 'How the themes and codes sit together, sized by how many people said them.' },
  'audio-summary': { title: 'Audio summary', phase: 'A3-7', text: 'The executive summary read aloud with the browser’s own voice, so leadership can listen.' },
  exports: { title: 'Exports', phase: 'A3-2', text: 'The report as a file for the client: PDF, a web page, slides and a Word document.' },
  'lens-builder': { title: 'Lens builder', phase: 'A3-6', text: 'Re-read the same evidence through a lens with its own rules, as a separate report.' },
  'compare-lenses': { title: 'Compare lenses', phase: 'A3-6', text: 'Two lenses side by side on the same evidence.' },
}

/** A tool whose pop-up isn’t built yet. It says so, says what it will do, and shows what it would be built on today. */
export function ComingStudio({ tool, onClose }: { tool: ToolKey; onClose: () => void }) {
  const { model, accepted } = useWs()
  const p = PLANNED[tool] ?? { title: tool, phase: '', text: '' }
  const quotes = new Set(model.themes.flatMap((t) => t.codes.flatMap((c) => c.excerpts))).size
  return (
    <Studio open id={tool} onClose={onClose} title={p.title} description="Not built yet in the prototype." footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="flex max-w-xl flex-col gap-4 p-6" data-testid="coming-studio">
        <p className="text-sm text-ink">{p.text}</p>
        <div className="rounded-md border border-mist bg-paper p-4 text-sm">
          <p className="font-medium text-ink">What it will be built on, as things stand</p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-graphite">
            <li>{plural(accepted, 'accepted session')}</li>
            <li>{plural(model.themes.length, 'theme')} from the codebook and Emotion &amp; behaviour</li>
            <li>{plural(model.findings.filter((f) => !f.omitted).length, 'finding')} in the report</li>
            <li>{plural(quotes, 'quote')} under those themes, each with its session and timestamp</li>
          </ul>
        </div>
        <p className="text-xs text-graphite">Planned for Phase {p.phase}. Nothing here is mocked as a result.</p>
      </div>
    </Studio>
  )
}

// ─── excluded sessions, read-only ───────────────────────────────────────────

export function ExcludedDialog({ open, onClose, sessions }: { open: boolean; onClose: () => void; sessions: ReviewSession[] }) {
  return (
    <Modal open={open} onClose={onClose} title="Excluded sessions" description="Left out of every count, quote and clip in this report. Read-only: change a decision in Review." footer={<Button onClick={onClose}>Close</Button>}>
      <ul className="flex flex-col gap-2 pb-1" data-testid="excluded-list">
        {sessions.length === 0 && <li className="text-sm text-graphite">No sessions were excluded.</li>}
        {sessions.map((s) => (
          <li key={s.id} className="rounded-sm border border-mist px-3 py-2.5 text-sm">
            <p className="font-medium text-ink">
              {s.participantId} <span className="font-normal text-graphite">· Session {s.id}</span>
            </p>
            <p className="mt-0.5 text-xs text-graphite">{s.decision ? `Excluded by ${s.decision.by} on ${formatDateTime(s.decision.at)}: ${s.decision.note}` : 'Excluded in Review.'}</p>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
