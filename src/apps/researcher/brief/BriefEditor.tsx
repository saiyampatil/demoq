import { useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { FileIcon, HistoryIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { formatDate, formatDateTime } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import {
  acceptAI,
  discardChanges,
  editSection,
  latestVersion,
  openChangeRequest,
  readiness,
  resolveFollowUp,
  saveVersion,
  SECTION_KEYS,
  sectionMeta,
  type SectionKey,
} from '@/state/brief'
import { useFeature } from '@/state/features'
import { PageHeader } from '../../shared/PageHeader'
import { AssumptionLedger } from './AssumptionLedger'
import { NoBrief } from './NoBrief'
import { OriginalInputDrawer } from './OriginalInputDrawer'
import { ReadinessPanel, ShareChecklist } from './ReadinessPanel'
import { SectionCard } from './SectionCard'
import { SectionStatusIcon, stateLabel } from './SectionStatusIcon'
import { useBrief } from './useBrief'
import { VersionHistoryDrawer } from './VersionHistoryDrawer'

type Drawer = { kind: 'original'; highlight?: string } | { kind: 'history' } | null

export function BriefEditor() {
  const { studyId, doc, editable, me, update } = useBrief()
  const [drawer, setDrawer] = useState<Drawer>(null)
  const showReadiness = useFeature('readinessPanel')
  const showLedger = useFeature('assumptionLedger')
  const showAiDiff = useFeature('aiDraftDiff')

  if (!doc?.intakeComplete || !doc.draft) return <NoBrief studyId={studyId} editable={editable} />

  const draft = doc.draft
  const latest = latestVersion(doc)!
  const ready = readiness(doc)
  const changeRequest = openChangeRequest(doc)
  const needsReapproval = doc.status !== 'Approved' && doc.approval && doc.approval.version < latest.number

  const jump = (k: SectionKey) => document.getElementById(`section-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const shareButton = (
    <Button variant={ready.dirty ? 'secondary' : 'primary'} to={studyPath(studyId, screenById.R5)} disabled={!ready.canShare}>
      Share with client
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="R4"
        title="Brief editor"
        meta={
          <>
            <span className="font-medium text-ink tabular-nums">Version {latest.number}</span>
            <StatusChip status={doc.status} size="sm" />
            {ready.dirty ? (
              <span className="flex items-center gap-1.5 text-pending-fg">
                <span className="size-1.5 rounded-full bg-pending-fg" aria-hidden="true" />
                Unsaved changes
              </span>
            ) : (
              <span className="tabular-nums">Last saved {formatDateTime(latest.savedAt)}</span>
            )}
          </>
        }
        actions={
          <>
            <Button variant="ghost" icon={<FileIcon />} onClick={() => setDrawer({ kind: 'original' })}>
              View original input
            </Button>
            <Button variant="ghost" icon={<HistoryIcon />} onClick={() => setDrawer({ kind: 'history' })}>
              Version history
            </Button>
            {ready.dirty && (
              <Button variant="ghost" onClick={() => update(discardChanges)}>
                Discard changes
              </Button>
            )}
            <Button variant={ready.dirty ? 'primary' : 'secondary'} disabled={!ready.dirty} onClick={() => update((d) => saveVersion(d, me))}>
              Save version
            </Button>
            {ready.canShare ? (
              shareButton
            ) : (
              <Tooltip focusable content={`You can’t share yet: ${ready.blockers.join('. ')}.`}>
                {shareButton}
              </Tooltip>
            )}
          </>
        }
      />

      {doc.status === 'Approved' && ready.dirty && (
        <Banner tone="warning" title={`You’re editing approved version ${latest.number}`}>
          Saving creates version {latest.number + 1}, which needs approval again. Anything built from version {latest.number} will be flagged for review.
        </Banner>
      )}
      {needsReapproval && doc.approval && (
        <Banner tone="warning" title={`Version ${latest.number} needs approval`}>
          Version {doc.approval.version} was approved on {formatDate(doc.approval.at)}. The Audience step stays locked until a new version is approved, and
          anything built from version {doc.approval.version} will be flagged for review.
        </Banner>
      )}
      {changeRequest && (
        <Banner tone="info" title={`${changeRequest.client} requested changes to version ${changeRequest.version}`}>
          “{changeRequest.feedback}”
        </Banner>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--spacing-topbar)+24px)]">
          <nav aria-label="Brief sections" className="rounded-md border border-mist bg-surface p-2">
            <ul className="flex flex-col">
              {SECTION_KEYS.map((k) => (
                <li key={k}>
                  <button type="button" onClick={() => jump(k)} className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left hover:bg-haze">
                    <SectionStatusIcon state={ready.states[k]} />
                    <span className="min-w-0 flex-1 text-sm">{sectionMeta[k].title}</span>
                    <span className={cn('text-xs', ready.states[k] === 'ready' ? 'text-muted' : 'text-graphite')}>{stateLabel[ready.states[k]]}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1 border-t border-mist px-2 pt-2 pb-1 text-xs text-graphite">
              Previous research found in input: {doc.previousResearch ? 'yes' : 'no'}.{' '}
              <button type="button" className="rounded-xs underline hover:text-ink" onClick={() => setDrawer({ kind: 'original' })}>
                Shown in original input.
              </button>
            </p>
          </nav>
          {showReadiness ? <ReadinessPanel ready={ready} onJump={jump} /> : <ShareChecklist ready={ready} />}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {SECTION_KEYS.map((k) => (
            <SectionCard
              // Remount when the saved text changes underneath (discard, follow-up answers) so local edit state resets.
              key={`${k}-${draft[k].lastEdited.at}`}
              sectionKey={k}
              section={draft[k]}
              followUps={doc.followUps.filter((f) => f.section === k)}
              showAiDiff={showAiDiff}
              onSave={(text) => update((d) => editSection(d, k, text, me))}
              onAccept={() => update((d) => acceptAI(d, k, me))}
              onResolve={(id, status, answer) => update((d) => resolveFollowUp(d, id, status, me, answer))}
              onShowSource={(span) => setDrawer({ kind: 'original', highlight: span })}
            />
          ))}
          {showLedger && <AssumptionLedger doc={doc} />}
        </div>
      </div>

      <OriginalInputDrawer
        open={drawer?.kind === 'original'}
        onClose={() => setDrawer(null)}
        original={doc.original}
        previousResearch={doc.previousResearch}
        highlight={drawer?.kind === 'original' ? drawer.highlight : undefined}
      />
      <VersionHistoryDrawer open={drawer?.kind === 'history'} onClose={() => setDrawer(null)} doc={doc} />
    </div>
  )
}
