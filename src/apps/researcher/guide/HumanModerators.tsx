import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, TextField } from '@/components/Field'
import { CheckIcon, CloseIcon, PlusIcon } from '@/components/icons'
import { EmptyState } from '@/components/States'
import { StatusChip } from '@/components/StatusChip'
import { useToast } from '@/components/Toast'
import { formatDateTime } from '@/lib/format'
import { HUMAN_MODERATORS } from '@/mock/moderation'
import { addMyself, coverage, hoursIn, inviteTeam, removeMember, requestPulseAI, requestRoster, resendMember, teamOf, type GuideDoc, type ModSource } from '@/state/guide'

const SOURCE_LABEL: Record<ModSource, string> = { Myself: 'Myself', PulseAI: 'PulseAI', 'My team': 'My team' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type Props = {
  doc: GuideDoc
  me: string
  /** The study language, from the brief. Null until the brief gives one. */
  language: string | null
  /** Edits the setup, so on an approved guide it makes a new version like any other edit. */
  update: (fn: (d: GuideDoc) => GuideDoc) => void
  /** Interviews the study needs, and weeks in its fieldwork window, for the coverage line. */
  interviews: number | null
  weeks: number
}

/**
 * R12, human moderator. The person setting up the study may not be a researcher, so the choices are three plain
 * options that can be combined, one list of who was asked and where they stand, and one line on whether they cover it.
 */
export function HumanModerators({ doc, me, language, update, interviews, weeks }: Props) {
  const m = doc.moderator
  const team = teamOf(m)
  const toast = useToast()
  const [pulseOpen, setPulseOpen] = useState(() => team.some((t) => t.source === 'PulseAI'))
  const [teamOpen, setTeamOpen] = useState(() => team.some((t) => t.source === 'My team'))
  const myself = team.some((t) => t.source === 'Myself')
  const cover = coverage(m, interviews, weeks)

  const cards: { key: string; title: string; text: string; on: boolean; action: React.ReactNode }[] = [
    {
      key: 'myself',
      title: 'I’ll moderate',
      text: 'Best if you’ve run interviews before.',
      on: myself,
      action: myself ? (
        <span className="flex items-center gap-1 text-sm font-medium text-positive-fg">
          <CheckIcon size={14} /> Added, accepted
        </span>
      ) : (
        <Button size="sm" onClick={() => update((d) => addMyself(d, me, language ?? ''))} data-testid="add-myself">
          Add me
        </Button>
      ),
    },
    {
      key: 'pulseai',
      title: 'PulseAI moderators',
      text: 'Trained moderators from the PulseAI team. Recommended if you’re new to interviews.',
      on: pulseOpen || team.some((t) => t.source === 'PulseAI'),
      action: (
        <Button size="sm" onClick={() => setPulseOpen((x) => !x)} aria-expanded={pulseOpen} data-testid="open-pulseai">
          {pulseOpen ? 'Hide options' : 'Choose'}
        </Button>
      ),
    },
    {
      key: 'team',
      title: 'Someone from my team',
      text: 'Invite colleagues by email. They use the Moderator dashboard and see only their own sessions.',
      on: teamOpen || team.some((t) => t.source === 'My team'),
      action: (
        <Button size="sm" onClick={() => setTeamOpen((x) => !x)} aria-expanded={teamOpen} data-testid="open-team">
          {teamOpen ? 'Hide form' : 'Invite'}
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6" data-testid="human-moderators">
      <section aria-label="Moderator options">
        <h2 className="mb-1 text-md font-semibold">Who will moderate?</h2>
        <p className="mb-3 text-sm text-graphite">Pick one or combine them. Only moderators who accept count toward booking and coverage.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.key} className={cn('flex flex-col gap-3 rounded-md border bg-surface p-4', c.on ? 'border-ink ring-1 ring-ink' : 'border-mist')}>
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="mt-0.5 text-sm text-graphite">{c.text}</p>
              </div>
              <div className="mt-auto">{c.action}</div>
            </div>
          ))}
        </div>
      </section>

      {pulseOpen && <PulseAIPanel doc={doc} me={me} language={language} update={update} />}
      {teamOpen && <TeamPanel doc={doc} me={me} language={language} update={update} />}

      <Card title="Selected moderators" description="Everyone you asked, and where they stand." flush>
        {team.length === 0 ? (
          <EmptyState title="No moderators yet" description="Choose an option above. You need at least one to continue, and one to accept before launch." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm" data-testid="moderator-table">
              <caption className="sr-only">Selected moderators</caption>
              <thead>
                <tr className="border-b border-mist bg-haze text-graphite">
                  {['Name', 'Source', 'Language', 'Status', 'Hours available', ''].map((h, i) => (
                    <th key={i} scope="col" className="h-9 px-4 font-medium whitespace-nowrap">
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map((t) => (
                  <tr key={t.id} className="border-b border-mist last:border-0" data-testid="moderator-row" data-status={t.status}>
                    <th scope="row" className="px-4 py-3 font-medium">
                      {t.name}
                      {t.email && <span className="block text-xs font-normal text-graphite">{t.email}</span>}
                      {t.sentAt && t.status !== 'Accepted' && <span className="block text-xs font-normal text-graphite">Sent {formatDateTime(t.sentAt)}</span>}
                    </th>
                    <td className="px-4 py-3 whitespace-nowrap">{SOURCE_LABEL[t.source]}</td>
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap">{t.language}</span>
                      {language && t.language !== language && (
                        <span className="mt-0.5 block text-xs font-medium text-pending-fg" data-testid="language-warning">
                          Doesn’t match the study language, {language}.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={t.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{t.status === 'Accepted' ? `${hoursIn(t, weeks)} h` : <span className="text-graphite">Not counted yet</span>}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {t.status !== 'Accepted' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            update((d) => resendMember(d, t.id))
                            toast(`${t.source === 'My team' ? 'Invitation' : 'Request'} sent again to ${t.name}.`)
                          }}
                        >
                          Resend
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => update((d) => removeMember(d, me, t.id))} aria-label={`Remove ${t.name}`}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={cn('border-t border-mist px-5 py-3 text-sm tabular-nums', cover.short || cover.accepted === 0 ? 'bg-pending-bg text-pending-fg' : 'text-graphite')} data-testid="coverage-line">
          {cover.accepted === 0 ? 'No moderator has accepted yet. ' : `Accepted moderators have ${cover.available} hours available. `}
          {cover.needed > 0 ? `You need about ${cover.needed} (${cover.interviews} interviews × ${m.durationMin} min).` : 'Set the number of interviews in the audience to see how many hours you need.'}
          {cover.short && cover.accepted > 0 && ' Add or wait for more moderators.'}
        </p>
      </Card>
    </div>
  )
}

function PulseAIPanel({ doc, me, language, update }: { doc: GuideDoc; me: string; language: string | null; update: Props['update'] }) {
  const m = doc.moderator
  const team = teamOf(m)
  const [mode, setMode] = useState<'assign' | 'choose'>('assign')
  const [count, setCount] = useState(1)
  const toast = useToast()
  return (
    <Card title="PulseAI moderators" description="Trained moderators from the PulseAI team. Recommended if you’re new to interviews.">
      <div className="flex flex-col gap-4" data-testid="pulseai-panel">
        <div role="radiogroup" aria-label="How to get PulseAI moderators" className="inline-flex self-start rounded-sm border border-mist-strong bg-haze p-0.5">
          {([
            ['assign', 'Let PulseAI assign'],
            ['choose', 'Choose specific moderators'],
          ] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cn('rounded-xs px-3 py-1 text-sm', mode === v ? 'bg-surface font-semibold text-ink shadow-raised' : 'text-graphite hover:text-ink')}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'assign' ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">How many moderators</span>
              <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} className={cn(controlBase, 'h-9 w-24 tabular-nums')} />
            </label>
            <Button
              variant="primary"
              onClick={() => {
                update((d) => requestPulseAI(d, me, count, language ?? ''))
                toast(`Requested ${count} PulseAI ${count === 1 ? 'moderator' : 'moderators'}. They show as Requested until PulseAI confirms.`)
              }}
              data-testid="request-pulseai"
            >
              Request {count} {count === 1 ? 'moderator' : 'moderators'}
            </Button>
            <p className="basis-full text-xs text-graphite">PulseAI matches people to your study language and confirms. Status stays Requested until then.</p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="roster">
            {HUMAN_MODERATORS.map((h) => {
              const asked = team.find((t) => t.rosterId === h.id)
              const speaks = !language || h.languages.includes(language)
              return (
                <li key={h.id} className="flex flex-col gap-2 rounded-md border border-mist bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{h.name}</p>
                      <p className="text-sm text-graphite">{h.title}</p>
                      <p className="text-xs text-graphite">{h.languages.join(', ')} · <span className="tabular-nums">{h.weeklyHours}</span> hours a week</p>
                      {!speaks && <p className="mt-0.5 text-xs font-medium text-pending-fg">Doesn’t speak {language}.</p>}
                    </div>
                    {asked ? <StatusChip status={asked.status} size="sm" /> : <Button size="sm" onClick={() => update((d) => requestRoster(d, me, h.id, language ?? ''))} aria-label={`Request ${h.name}`}>Request</Button>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}

function TeamPanel({ doc, me, language, update }: { doc: GuideDoc; me: string; language: string | null; update: Props['update'] }) {
  const [rows, setRows] = useState([{ name: '', email: '' }])
  const toast = useToast()
  const valid = rows.filter((r) => r.name.trim() && EMAIL.test(r.email.trim()))
  const bad = rows.filter((r) => (r.name.trim() || r.email.trim()) && !(r.name.trim() && EMAIL.test(r.email.trim())))
  const taken = new Set(teamOf(doc.moderator).map((t) => t.email?.toLowerCase()))
  const dupes = valid.filter((r) => taken.has(r.email.trim().toLowerCase()))
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  return (
    <Card title="Someone from my team" description="Each person gets an invitation by email and shows as Invited until they accept.">
      <form
        className="flex flex-col gap-4"
        data-testid="team-panel"
        onSubmit={(e) => {
          e.preventDefault()
          const fresh = valid.filter((r) => !taken.has(r.email.trim().toLowerCase()))
          if (!fresh.length) return
          update((d) => inviteTeam(d, me, fresh, language ?? ''))
          toast(`${fresh.length === 1 ? 'Invitation' : 'Invitations'} sent to ${fresh.map((r) => r.name.trim()).join(', ')}.`)
          setRows([{ name: '', email: '' }])
        }}
      >
        <ul className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <li key={i} className="flex flex-wrap items-end gap-3">
              <TextField label={i === 0 ? 'Name' : undefined} aria-label={`Name ${i + 1}`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} containerClassName="w-56" placeholder="Priya Menon" />
              <TextField label={i === 0 ? 'Email' : undefined} aria-label={`Email ${i + 1}`} type="email" value={r.email} onChange={(e) => set(i, { email: e.target.value })} containerClassName="w-72" placeholder="priya@company.com" />
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))} aria-label={`Remove row ${i + 1}`} className="mb-1 rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink">
                  <CloseIcon size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {bad.length > 0 && <p className="text-sm text-negative-fg">Each person needs a name and a valid email.</p>}
        {dupes.length > 0 && <p className="text-sm text-pending-fg">{dupes.map((d) => d.email).join(', ')} {dupes.length === 1 ? 'is' : 'are'} already on the list.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<PlusIcon />} onClick={() => setRows((rs) => [...rs, { name: '', email: '' }])} data-testid="add-another">
            Add another
          </Button>
          <Button type="submit" variant="primary" disabled={valid.filter((r) => !taken.has(r.email.trim().toLowerCase())).length === 0} data-testid="send-invites">
            Send {valid.length > 1 ? `${valid.length} invitations` : 'invitation'}
          </Button>
        </div>
        <p className="text-xs text-graphite">Once they accept, they use the Moderator dashboard, set their own availability and see only their own sessions. They can’t edit the study.</p>
      </form>
    </Card>
  )
}
