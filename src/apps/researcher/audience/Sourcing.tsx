import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { TextArea } from '@/components/Field'
import { CheckIcon, CloseIcon, PaperclipIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { Table, type Column } from '@/components/Table'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { formatDate } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import {
  addCandidates,
  countBySource,
  editSourcing,
  idExample,
  idTypeLabel,
  invitedCount,
  invitesFor,
  notInvited,
  parseIds,
  sendInvites,
  type Candidate,
  type IdType,
  type SourceOption,
  type SourceTag,
} from '@/state/audience'
import { PageHeader } from '../../shared/PageHeader'
import { AudienceGate } from './AudienceGate'
import { useAudience } from './useAudience'

const OPTIONS: { value: SourceOption; title: string; description: string }[] = [
  { value: 'manual', title: 'Upload or paste participants', description: 'People you already have. Paste their User IDs or phone numbers, one per line.' },
  { value: 'external', title: 'External upload', description: 'Import a file from an external panel or your own system.' },
]

export function Sourcing() {
  const { studyId, audience, editable, update } = useAudience()
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)

  if (!editable || !audience?.def) return <AudienceGate studyId={studyId} editable={editable} />

  const s = audience.sourcing
  const def = audience.def
  const audienceReady = audience.status === 'Confirmed'
  const screenerReady = audience.screener?.status === 'Ready'
  const ready = audienceReady && screenerReady
  const target = invitesFor(def.total, def.bufferPct)
  const pending = notInvited(s)
  const invited = invitedCount(s)
  const gateReason = !audienceReady ? 'Confirm the audience first' : !screenerReady ? 'Accept the screener first' : undefined

  const send = () => {
    update((d) => sendInvites(d).doc)
    // The wait for invitees to accept and answer is simulated, so go straight to the results.
    navigate(studyPath(studyId, screenById.R9))
  }

  const columns: Column<Candidate>[] = [
    { key: 'value', header: 'Participant', cell: (c) => <span className="font-medium tabular-nums">{c.value}</span> },
    { key: 'type', header: 'Type', cell: (c) => idTypeLabel[c.idType].replace(/s$/, '') },
    { key: 'source', header: 'Source', cell: (c) => <SourceChip source={c.source} /> },
    { key: 'invite', header: 'Invite', cell: (c) => (c.invitedAt ? <span className="whitespace-nowrap">Sent {formatDate(c.invitedAt)}</span> : <span className="text-graphite">Not sent</span>) },
    {
      key: 'remove',
      header: <span className="sr-only">Remove</span>,
      align: 'right',
      cell: (c) =>
        c.invitedAt ? null : (
          <button
            type="button"
            onClick={() => update((d) => editSourcing(d, (x) => ({ ...x, candidates: x.candidates.filter((y) => y.id !== c.id) })))}
            aria-label={`Remove ${c.value}`}
            className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink"
          >
            <CloseIcon size={14} />
          </button>
        ),
    },
  ]
  const rows = showAll ? s.candidates : s.candidates.slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="R8" title="Participant sourcing" description="Choose where applicants come from. Everyone who applies answers the screener." />

      {!ready && (
        <Banner tone="warning" title="Sourcing opens once the audience and screener are ready">
          <ul className="mt-1 flex flex-col gap-1">
            <li className="flex flex-wrap items-center gap-2">
              {audienceReady ? 'Audience confirmed.' : 'The audience definition isn’t confirmed.'}
              {!audienceReady && (
                <Button size="sm" to={studyPath(studyId, screenById.R6)}>
                  Go to audience definition
                </Button>
              )}
            </li>
            <li className="flex flex-wrap items-center gap-2">
              {screenerReady ? 'Screener accepted.' : audience.screener ? 'The screener isn’t accepted.' : 'The screener is written once the audience is confirmed.'}
              {!screenerReady && (
                <Button size="sm" to={studyPath(studyId, screenById.R7)}>
                  Go to screener
                </Button>
              )}
            </li>
          </ul>
          <p className="mt-2">You can add participants now. Invites are held until both are ready.</p>
        </Banner>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Where do applicants come from?</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {OPTIONS.map((o) => {
            const on = s.option === o.value
            return (
              <label
                key={o.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-md border bg-surface p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-iris-600',
                  on ? 'border-ink ring-1 ring-ink' : 'border-mist hover:border-graphite',
                )}
              >
                <input type="radio" name="source" value={o.value} checked={on} onChange={() => update((d) => editSourcing(d, (x) => ({ ...x, option: o.value })))} className="sr-only" />
                <span aria-hidden="true" className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-ink' : 'border-graphite')}>
                  {on && <span className="size-2 rounded-full bg-ink" />}
                </span>
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="mt-0.5 block text-sm text-graphite">{o.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {s.option === 'manual' ? (
        <PasteCard
          key="manual"
          title="Upload or paste participants"
          source="Manual"
          fixedType={null}
          existing={s.candidates}
          onAdd={(values, type) => update((d) => addCandidates(d, values, type, 'Manual'))}
        />
      ) : (
        <UploadCard existing={s.candidates} onAdd={(values) => update((d) => addCandidates(d, values, 'userId', 'External'))} />
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Stat label="People to invite" value={target ?? 'Not set'} hint={target ? `${def.total} interviews + ${def.bufferPct}% buffer` : 'Set in audience definition'} />
          <Stat label="In the pool" value={s.candidates.length} hint={`${countBySource(s, 'Manual')} Manual, ${countBySource(s, 'External')} External`} />
          <Stat label="Invited" value={invited} />
          <Stat label="Waiting to be invited" value={pending} />
          <span className="flex-1" />
          {ready ? (
            <Button variant="primary" disabled={pending === 0} onClick={send}>
              Send screener invites{pending ? ` (${pending})` : ''}
            </Button>
          ) : (
            <Tooltip focusable content={`${gateReason}.`}>
              <Button variant="primary" disabled>
                Send screener invites
              </Button>
            </Tooltip>
          )}
        </div>
      </Card>

      <Card title="Participants" flush>
        <Table
          caption="Participants in the pool"
          columns={columns}
          rows={rows}
          rowKey={(c) => c.id}
          empty={<EmptyState title="No participants yet" description="Paste User IDs or phone numbers above to build the pool." />}
        />
        {s.candidates.length > 10 && (
          <div className="border-t border-mist px-5 py-3">
            <Button size="sm" variant="ghost" onClick={() => setShowAll((x) => !x)}>
              {showAll ? 'Show fewer' : `Show all ${s.candidates.length}`}
            </Button>
          </div>
        )}
      </Card>

      <WizardFooter previous={{ to: studyPath(studyId, screenById.R7), label: 'Screener' }} message={invited ? `${invited} invited so far.` : 'Add participants, then send the screener invites.'}>
        {invited > 0 ? (
          <Button variant="primary" to={studyPath(studyId, screenById.R9)}>
            Continue to screening
          </Button>
        ) : (
          <Tooltip focusable content="Send screener invites first.">
            <Button variant="primary" disabled>
              Continue to screening
            </Button>
          </Tooltip>
        )}
      </WizardFooter>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div>
      <p className="text-sm text-graphite">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-graphite">{hint}</p>}
    </div>
  )
}

function SourceChip({ source }: { source: SourceTag }) {
  return <span className="inline-flex items-center rounded-xs border border-mist-strong bg-haze px-1.5 py-0.5 text-xs font-medium text-ink">{source}</span>
}

function PasteCard({
  title,
  source,
  fixedType,
  existing,
  bare,
  onAdd,
}: {
  title: string
  source: SourceTag
  /** Set when the route only takes one kind of ID. */
  fixedType: IdType | null
  existing: Candidate[]
  bare?: boolean
  onAdd: (values: string[], type: IdType) => void
}) {
  const [type, setType] = useState<IdType>(fixedType ?? 'userId')
  const [text, setText] = useState('')
  const [added, setAdded] = useState<string>()
  const check = useMemo(() => parseIds(text, type, existing), [text, type, existing])
  const touched = text.trim().length > 0

  const body = (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!check.valid.length) return
        onAdd(check.valid, type)
        setAdded(`Added ${check.valid.length} ${source} ${check.valid.length === 1 ? 'participant' : 'participants'}.`)
        // Invalid lines stay in the box to be fixed.
        setText(check.invalid.map((i) => i.line).join('\n'))
      }}
    >
      {fixedType === null && (
        <div role="radiogroup" aria-label="What are you pasting?" className="inline-flex self-start rounded-sm border border-mist-strong bg-haze p-0.5">
          {(Object.keys(idTypeLabel) as IdType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => {
                setType(t)
                setAdded(undefined)
              }}
              className={cn('rounded-xs px-3 py-1 text-sm', type === t ? 'bg-surface font-semibold text-ink shadow-raised' : 'text-graphite hover:text-ink')}
            >
              {idTypeLabel[t]}
            </button>
          ))}
        </div>
      )}
      <TextArea
        label={`${bare ? title : idTypeLabel[type]}, one per line`}
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setAdded(undefined)
        }}
        placeholder={`${idExample[type]}\n${type === 'phone' ? '415-555-0173' : 'usr_48220'}`}
        hint={`Example: ${idExample[type]}. Blank lines and duplicates are dropped for you.`}
      />
      {touched && (
        <div role="status" className="flex flex-col gap-1 text-sm">
          <p className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            <span className={check.valid.length ? 'font-medium text-positive-fg' : 'text-graphite'}>{check.valid.length} valid</span>
            <span className="text-graphite">{check.duplicates} {check.duplicates === 1 ? 'duplicate' : 'duplicates'} removed</span>
            <span className="text-graphite">{check.blanks} blank {check.blanks === 1 ? 'line' : 'lines'} removed</span>
            <span className={check.invalid.length ? 'font-medium text-negative-fg' : 'text-graphite'}>{check.invalid.length} invalid</span>
          </p>
          {check.invalid.length > 0 && (
            <ul className="text-negative-fg">
              {check.invalid.slice(0, 5).map((i, n) => (
                <li key={n}>
                  <span className="font-medium">{i.line}</span>: {i.reason}
                </li>
              ))}
              {check.invalid.length > 5 && <li>and {check.invalid.length - 5} more</li>}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={!check.valid.length}>
          {check.valid.length ? `Add ${check.valid.length} ${check.valid.length === 1 ? 'participant' : 'participants'}` : 'Add participants'}
        </Button>
        {added && (
          <span role="status" className="flex items-center gap-1 text-sm text-positive-fg">
            <CheckIcon size={14} /> {added}
          </span>
        )}
      </div>
    </form>
  )
  return bare ? body : <Card title={title}>{body}</Card>
}

const MOCK_IMPORT = 12

function UploadCard({ existing, onAdd }: { existing: Candidate[]; onAdd: (values: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string>()

  const importFile = async (file: File) => {
    // Any file type is accepted. Text files are read line by line; anything else gets sample participants,
    // because the real panel import is still to be confirmed.
    let values: string[] = []
    let readable = false
    if (file.size < 2_000_000) {
      try {
        const text = await file.text()
        const first = text.split(/\r?\n/).map((l) => l.split(/[,;\t]/)[0].trim())
        const r = parseIds(first.join('\n'), 'userId', existing)
        if (r.valid.length && r.invalid.length <= r.valid.length) {
          values = r.valid
          readable = true
        }
      } catch {
        // Unreadable: fall through to sample data.
      }
    }
    if (!readable) {
      const seen = new Set(existing.map((c) => c.value))
      values = Array.from({ length: MOCK_IMPORT }, (_, i) => `EXT-${70100 + existing.length + i * 3}`).filter((v) => !seen.has(v))
    }
    onAdd(values)
    setNote(
      readable
        ? `Imported ${values.length} External ${values.length === 1 ? 'participant' : 'participants'} from ${file.name}.`
        : `Imported ${file.name}. Its contents can’t be read in the prototype, so ${values.length} sample External participants were added.`,
    )
  }

  return (
    <Card title="External upload" description="Import a file from an external panel or your own system. Any file type works.">
      <div className="flex flex-col gap-3">
        <input
          ref={ref}
          type="file"
          aria-label="Choose a file to import"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) await importFile(file)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={<PaperclipIcon />} onClick={() => ref.current?.click()}>
            Choose a file
          </Button>
          {note && (
            <span role="status" className="flex items-center gap-1 text-sm text-positive-fg">
              <CheckIcon size={14} /> {note}
            </span>
          )}
        </div>
        <p className="text-xs text-graphite">Imported people are tagged External. Panel integration is to be confirmed.</p>
      </div>
    </Card>
  )
}
