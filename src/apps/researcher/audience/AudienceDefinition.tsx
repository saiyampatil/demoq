import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button, Spinner } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { CheckIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDate, formatDateTime } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import {
  advanceDraft,
  approvedBriefSections,
  confirmAudience,
  confirmBlockers,
  discardAudienceChanges,
  draftStepLabel,
  editDef,
  invitesFor,
  cohortNameFrom,
  startDraft,
  type AudienceDef,
  type Cohort,
} from '@/state/audience'
import { PageHeader } from '../../shared/PageHeader'
import { AudienceGate } from './AudienceGate'
import { CohortCard } from './CohortCard'
import { ExclusionsCard } from './ExclusionsCard'
import { OriginTag } from './OriginTag'
import { useAudience } from './useAudience'

const input = cn(controlBase, 'h-9 tabular-nums')

export function AudienceDefinition() {
  const { studyId, brief, audience, editable, me, set, update } = useAudience()
  const navigate = useNavigate()
  const approved = approvedBriefSections(brief)

  // The AI drafts the audience the first time R6 opens after the brief is approved.
  useEffect(() => {
    if (editable && approved && !audience) set(startDraft(studyId, approved.version))
  }, [editable, approved?.version, audience === undefined, studyId])

  // Runs the drafting steps one at a time; state is persisted, so a refresh picks up where it left off.
  useEffect(() => {
    if (!audience?.pending.length || !approved) return
    const t = setTimeout(() => update((d) => advanceDraft(d, approved.sections)), 1100)
    return () => clearTimeout(t)
  }, [audience?.pending.join(), approved?.version, update])

  if (!editable) return <AudienceGate studyId={studyId} editable={false} />
  if (!audience?.def) {
    // The stepper keeps R6 locked until the brief is approved, so this only shows while drafting.
    if (!approved) return <AudienceGate studyId={studyId} editable />
    return <Drafting steps={audience?.pending ?? ['read', 'draft']} briefVersion={approved.version} />
  }

  const def = audience.def
  const edit = (fn: (d: AudienceDef) => AudienceDef) => update((doc) => editDef(doc, me, fn))
  // The cohort's name follows its filters until the Researcher renames it.
  const editCohort = (fn: (c: Cohort) => Cohort) =>
    edit((d) => {
      const c = fn(d.cohort)
      return { ...d, cohort: c.nameOrigin === 'ai' ? { ...c, name: cohortNameFrom(c.filters) } : c }
    })
  const blockers = confirmBlockers(def)
  const reopened = audience.status === 'Draft' && audience.confirmed
  const briefMoved = approved && approved.version !== audience.briefVersion
  const invites = invitesFor(def.total, def.bufferPct)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="R6"
        title="Audience definition"
        meta={
          <>
            <StatusChip status={audience.status} size="sm" />
            <span className="font-medium text-ink tabular-nums">Version {audience.version}</span>
            {audience.status === 'Confirmed' && audience.confirmed ? (
              <span>
                Confirmed by {audience.confirmed.by}, <span className="tabular-nums">{formatDateTime(audience.confirmed.at)}</span>
              </span>
            ) : (
              <span>Not confirmed yet</span>
            )}
          </>
        }
        actions={
          reopened && (
            <Button variant="ghost" onClick={() => update(discardAudienceChanges)}>
              Discard changes
            </Button>
          )
        }
      />

      {reopened && audience.confirmed && (
        <Banner tone="warning" title={`You’re editing confirmed version ${audience.confirmed.version}`}>
          This is now version {audience.version}, a draft. Moderator & Guide is locked until you confirm it. The screener is flagged for review, and
          sourcing set up for version {audience.confirmed.version} will need a check.
        </Banner>
      )}
      {briefMoved && (
        <Banner tone="warning" title={`Built from brief version ${audience.briefVersion}`}>
          Version {approved.version} of the brief is now approved. Check the audience still matches it.
        </Banner>
      )}
      <Card title="Participant count" description="How many completed interviews the study needs, and how many extra people to invite. This one number is the study’s target.">
        <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="total" className="text-sm font-medium">
              Completed interviews needed
            </label>
            <div className="flex items-center gap-2">
              <input
                id="total"
                type="number"
                min={1}
                value={def.total ?? ''}
                placeholder="Not set"
                onChange={(e) => {
                  const n = e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value)))
                  edit((d) => ({ ...d, total: n, totalOrigin: n === null ? 'missing' : 'edited', totalNote: undefined }))
                }}
                className={cn(input, 'w-28', !def.total && 'border-pending-line')}
              />
              <OriginTag origin={def.totalOrigin} />
            </div>
            <p className="text-xs text-graphite">{def.totalNote ? `${def.totalNote}, so it’s left for you to set.` : 'From the brief’s sample size.'}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="buffer" className="text-sm font-medium">
              Over-recruitment buffer
            </label>
            <div className="flex items-center gap-2">
              <input
                id="buffer"
                type="number"
                min={0}
                max={100}
                value={def.bufferPct}
                onChange={(e) => edit((d) => ({ ...d, bufferPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                className={cn(input, 'w-20')}
              />
              <span className="text-sm text-graphite">%</span>
            </div>
            <p className="text-xs text-graphite">Recommended 10–20%. Rounded up.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">People to invite</span>
            {invites ? (
              <p className="text-lg font-semibold tabular-nums">
                {invites}
                <span className="ml-2 text-sm font-normal text-graphite">
                  {def.total} interviews + {invites - def.total!} reserves
                </span>
              </p>
            ) : (
              <p className="text-sm text-graphite">Set the number of interviews first.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Cohort" description="One group of people for the whole study. Who qualifies is decided by the filters below, age included.">
        <CohortCard cohort={def.cohort} onChange={editCohort} />
      </Card>

      <ExclusionsCard
        exclusions={def.exclusions}
        screener={audience.screener}
        onChange={(fn) => edit((d) => ({ ...d, exclusions: fn(d.exclusions) }))}
      />

      <WizardFooter
        message={
          audience.status === 'Confirmed' && audience.confirmed ? (
            <span className="flex items-center gap-1.5 text-positive-fg">
              <CheckIcon /> Version {audience.confirmed.version} confirmed on {formatDate(audience.confirmed.at)}. Moderator & Guide is unlocked.
            </span>
          ) : blockers.length ? (
            `Before you confirm: ${blockers[0].charAt(0).toLowerCase()}${blockers[0].slice(1)}.`
          ) : (
            'Ready to confirm. This records your name, the time and the version. The AI then writes the screener.'
          )
        }
      >
        {audience.status === 'Confirmed' && audience.confirmed ? (
          <Button variant="primary" to={studyPath(studyId, screenById.R7)}>
            Continue to screener
          </Button>
        ) : blockers.length ? (
          <Tooltip focusable content={`${blockers.join('. ')}.`}>
            <Button variant="primary" disabled>
              Confirm and continue
            </Button>
          </Tooltip>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              update((d) => confirmAudience(d, me))
              navigate(studyPath(studyId, screenById.R7))
            }}
          >
            Confirm and continue
          </Button>
        )}
      </WizardFooter>
    </div>
  )
}

function Drafting({ steps, briefVersion }: { steps: string[]; briefVersion?: number }) {
  const all = ['read', 'draft'] as const
  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="R6" title="Audience definition" description={`The AI is drafting the audience from the approved brief${briefVersion ? ` (version ${briefVersion})` : ''}.`} />
      <Card>
        <ul className="flex flex-col gap-2" aria-live="polite">
          {all.map((s) => {
            const done = !steps.includes(s)
            const running = steps[0] === s
            return (
              <li key={s} className={cn('flex items-center gap-2', !done && !running && 'text-muted')}>
                {done ? <CheckIcon className="text-positive-fg" /> : running ? <Spinner /> : <span className="size-3.5" />}
                {done ? draftStepLabel[s].done : `${draftStepLabel[s].running}${running ? '…' : ''}`}
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-sm text-graphite">It only uses the approved brief. Anything the brief doesn’t say is left blank for you.</p>
      </Card>
    </div>
  )
}
