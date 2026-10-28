import { useRef, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlClass, TextArea, TextField } from '@/components/Field'
import { CloseIcon, PaperclipIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { Table, type Column } from '@/components/Table'
import { Tooltip } from '@/components/Tooltip'
import { formatDate } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import {
  createLink,
  editSourcing,
  invitedCount,
  invitesFor,
  notInvited,
  parseContacts,
  parsePanelIds,
  sendInvites,
  type Contact,
  type PanelMember,
} from '@/state/audience'
import { now } from '@/state/brief'
import { PageHeader } from '../../shared/PageHeader'
import { AudienceGate } from './AudienceGate'
import { useAudience } from './useAudience'

const LINK_BASE = 'https://pulseai.example/s/'

export function Sourcing() {
  const { studyId, audience, editable, me, update } = useAudience()
  const [sent, setSent] = useState<string>()

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
    const contacts = s.contacts.filter((c) => !c.invitedAt).length
    const panel = s.panel.members.filter((m) => !m.invitedAt).length
    const parts = [contacts && `${contacts} ${contacts === 1 ? 'contact' : 'contacts'}`, panel && `${panel} panel ${panel === 1 ? 'member' : 'members'}`].filter(Boolean)
    update((d) => sendInvites(d).doc)
    setSent(`Screener invites sent to ${parts.join(' and ')}.`)
  }

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
              {screenerReady ? 'Screener accepted.' : audience.screener ? 'The screener isn’t accepted.' : 'There’s no screener yet.'}
              {!screenerReady && (
                <Button size="sm" to={studyPath(studyId, screenById.R7)}>
                  Go to screener
                </Button>
              )}
            </li>
          </ul>
          <p className="mt-2">You can collect contacts and panel IDs now. Links and invites are held until both are ready.</p>
        </Banner>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Stat label="People to invite" value={target ?? 'Not set'} hint={target ? `${def.total} interviews + ${def.bufferPct}% buffer` : 'Set in audience definition'} />
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
        {sent && (
          <Banner tone="success" title={sent} className="mt-4">
            Sending is simulated in the prototype.
          </Banner>
        )}
      </Card>

      <LinkCard
        link={s.link}
        ready={ready}
        gateReason={gateReason}
        onCreate={() => update((d) => createLink(d, me))}
      />
      <ContactsCard contacts={s.contacts} onAdd={(added) => update((d) => editSourcing(d, (x) => ({ ...x, contacts: [...x.contacts, ...added] })))} onRemove={(id) => update((d) => editSourcing(d, (x) => ({ ...x, contacts: x.contacts.filter((c) => c.id !== id) })))} />
      <PanelCard
        name={s.panel.name}
        members={s.panel.members}
        onName={(name) => update((d) => editSourcing(d, (x) => ({ ...x, panel: { ...x.panel, name } })))}
        onAdd={(ids) => update((d) => editSourcing(d, (x) => ({ ...x, panel: { ...x.panel, members: [...x.panel.members, ...ids.map((id) => ({ id, addedAt: now() }))] } })))}
        onClearUninvited={() => update((d) => editSourcing(d, (x) => ({ ...x, panel: { ...x.panel, members: x.panel.members.filter((m) => m.invitedAt) } })))}
      />
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

function LinkCard({ link, ready, gateReason, onCreate }: { link: { code: string; createdAt: string; createdBy: string } | null; ready: boolean; gateReason?: string; onCreate: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = link ? `${LINK_BASE}${link.code}` : ''
  return (
    <Card title="Recruitment link" description="Share it through your own channels. Anyone with the link can apply through the screener.">
      {link ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={url} aria-label="Recruitment link" onFocus={(e) => e.target.select()} className={cn(controlClass, 'h-9 max-w-md flex-1 bg-paper')} />
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url)
                } catch {
                  // Clipboard can be blocked; the field stays selectable.
                }
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button variant="ghost" to={`/p/${link.code}/welcome`}>
              Open as a participant
            </Button>
          </div>
          <p className="text-xs text-graphite">
            Created by {link.createdBy}, {formatDate(link.createdAt)}. The participant screens are built in Phase 2b; until then the link opens a placeholder.
          </p>
        </div>
      ) : ready ? (
        <Button onClick={onCreate}>Create recruitment link</Button>
      ) : (
        <Tooltip focusable align="left" content={`${gateReason}.`}>
          <Button disabled>Create recruitment link</Button>
        </Tooltip>
      )}
    </Card>
  )
}

function ContactsCard({ contacts, onAdd, onRemove }: { contacts: Contact[]; onAdd: (c: Contact[]) => void; onRemove: (id: string) => void }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ added: number; duplicates: string[]; invalid: string[] }>()
  const fileRef = useRef<HTMLInputElement>(null)

  const columns: Column<Contact>[] = [
    { key: 'name', header: 'Name', cell: (c) => c.name || <span className="text-muted">No name</span> },
    { key: 'email', header: 'Email', cell: (c) => <span className="break-all">{c.email}</span> },
    {
      key: 'status',
      header: 'Invite',
      cell: (c) => (c.invitedAt ? <span className="whitespace-nowrap">Sent {formatDate(c.invitedAt)}</span> : <span className="text-graphite">Not sent</span>),
    },
    {
      key: 'remove',
      header: <span className="sr-only">Remove</span>,
      align: 'right',
      cell: (c) => (
        <button type="button" onClick={() => onRemove(c.id)} aria-label={`Remove ${c.email}`} className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink">
          <CloseIcon size={14} />
        </button>
      ),
    },
  ]

  return (
    <Card title="Upload contacts" description="People the client already knows. Paste them, or upload a CSV with a name and an email on each line." flush>
      <form
        className="flex flex-col gap-3 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          const r = parseContacts(text, contacts)
          if (r.added.length) onAdd(r.added)
          setResult({ added: r.added.length, duplicates: r.duplicates, invalid: r.invalid })
          setText(r.invalid.join('\n'))
        }}
      >
        <TextArea label="Contacts" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Rachel Kim, rachel.kim@mail.example\nmonica.alvarez@mail.example'} hint="One person per line. Duplicates are matched by email." />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={!text.trim()}>
            Add contacts
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) {
                const content = (await file.text()).trim()
                setText((t) => [t.trim(), content].filter(Boolean).join('\n'))
              }
              e.target.value = ''
            }}
          />
          <Button icon={<PaperclipIcon />} onClick={() => fileRef.current?.click()}>
            Upload CSV
          </Button>
        </div>
        {result && (
          <div role="status" className="text-sm">
            <p className={result.added ? 'text-positive-fg' : 'text-graphite'}>
              Added {result.added} {result.added === 1 ? 'contact' : 'contacts'}.
            </p>
            {result.duplicates.length > 0 && <p className="text-pending-fg">Skipped {result.duplicates.length} already in the list: {result.duplicates.join(', ')}.</p>}
            {result.invalid.length > 0 && (
              <p className="text-negative-fg">
                {result.invalid.length} {result.invalid.length === 1 ? 'line has' : 'lines have'} no valid email and {result.invalid.length === 1 ? 'was' : 'were'} left in the box to fix.
              </p>
            )}
          </div>
        )}
      </form>
      <div className="border-t border-mist">
        <Table
          caption="Contacts"
          columns={columns}
          rows={contacts}
          rowKey={(c) => c.id}
          empty={<EmptyState title="No contacts yet" description="Add the people you want to invite to the screener." />}
        />
      </div>
    </Card>
  )
}

function PanelCard({
  name,
  members,
  onName,
  onAdd,
  onClearUninvited,
}: {
  name: string
  members: PanelMember[]
  onName: (name: string) => void
  onAdd: (ids: string[]) => void
  onClearUninvited: () => void
}) {
  const [text, setText] = useState('')
  const [note, setNote] = useState<string>()
  const invited = members.filter((m) => m.invitedAt).length
  return (
    <Card title="External panel" description="Panel member IDs from a third-party recruitment panel.">
      <div className="flex flex-col gap-4">
        <p className="rounded-sm border border-dashed border-mist-strong px-3 py-2 text-sm text-graphite">
          The panel integration is still to be confirmed (PRD: “subject to integration feasibility”). IDs are kept here, and invites to them are simulated.
        </p>
        <TextField label="Panel name" value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Northstar Consumer Panel" containerClassName="max-w-sm" />
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const r = parsePanelIds(text, members)
            if (r.added.length) onAdd(r.added)
            setNote(`Added ${r.added.length} ${r.added.length === 1 ? 'ID' : 'IDs'}.${r.duplicates ? ` Skipped ${r.duplicates} already in the list.` : ''}`)
            setText('')
          }}
        >
          <TextArea label="Panel member IDs" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="NS-48210, NS-48217, NS-48224" hint="Separate IDs with commas, spaces or new lines." />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!text.trim()}>
              Add IDs
            </Button>
            {note && (
              <span role="status" className="text-sm text-graphite">
                {note}
              </span>
            )}
          </div>
        </form>
        {members.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              <span className="font-medium tabular-nums">{members.length}</span> {members.length === 1 ? 'member' : 'members'},{' '}
              <span className="tabular-nums">{invited}</span> invited
            </p>
            <p className="text-sm break-words text-graphite">
              {members.slice(0, 12).map((m) => m.id).join(', ')}
              {members.length > 12 && `, and ${members.length - 12} more`}
            </p>
            {members.length > invited && (
              <Button size="sm" variant="ghost" className="self-start" onClick={onClearUninvited}>
                Remove the {members.length - invited} not yet invited
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-graphite">No panel IDs yet.</p>
        )}
      </div>
    </Card>
  )
}
