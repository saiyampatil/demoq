import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/Field'
import { PlusIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { StatusChip } from '@/components/StatusChip'
import { useToast } from '@/components/Toast'
import { type TeamMember } from '@/state/guide'
import { EXPERTISE_TAGS } from '@/mock/expertise'
import { addTeamPerson, EMAIL, findByEmail, parseTags, resendTeamInvite, useTeamModerators, type TeamPerson } from '@/state/teamModerators'
import { DevAcceptInvite } from './ModeratorBits'

type Props = {
  /** Who is already on this list (the interview team, or standby), so a person can't be added twice. */
  added: TeamMember[]
  me: string
  /** Puts a person from the team list on this study. */
  onAdd: (person: TeamPerson) => void
  onRemove: (memberId: string) => void
  /** The study language is needed before anyone can be added. */
  disabled?: boolean
}

/**
 * "Someone from my team": the company's list of moderators, reused across studies. Any researcher can add someone new.
 * A new person is invited by email and counts once they accept; until then they are on the study as Invited.
 */
export function TeamModeratorPicker({ added, me, onAdd, onRemove, disabled }: Props) {
  const people = useTeamModerators()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const onList = (p: TeamPerson) => added.find((t) => t.teamId === p.id)

  return (
    <Card
      title="Someone from my team"
      description="Your company’s moderators, shared by every study. A new person is invited by email and counts toward booking and coverage once they accept."
      actions={
        <Button size="sm" icon={<PlusIcon />} onClick={() => setOpen(true)} disabled={disabled} data-testid="team-add-new">
          Add new
        </Button>
      }
    >
      <ul className="grid gap-3 md:grid-cols-2" data-testid="team-roster">
        {people.map((p) => {
          const on = onList(p)
          return (
            <li key={p.id} className="flex flex-col gap-2 rounded-md border border-mist bg-surface p-3" data-testid="team-person" data-status={p.status}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="truncate text-sm text-graphite">{p.email}</p>
                  {p.tags.length > 0 && <p className="mt-0.5 text-xs text-graphite">{p.tags.join(' · ')}</p>}
                </div>
                {p.status === 'Invited' && <StatusChip status="Invited" size="sm" />}
              </div>
              {p.status === 'Invited' && <p className="text-xs text-graphite">Hasn’t accepted yet. They count once they do.</p>}
              <div className="flex flex-wrap items-center gap-2">
                {on ? (
                  <Button size="sm" variant="ghost" onClick={() => onRemove(on.id)} aria-label={`Remove ${p.name}`}>
                    Remove
                  </Button>
                ) : (
                  <Button size="sm" disabled={disabled} onClick={() => onAdd(p)} aria-label={`Add ${p.name}`}>
                    Add
                  </Button>
                )}
                {p.status === 'Invited' && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        resendTeamInvite(p.id)
                        toast(`Invitation sent again to ${p.email}.`)
                      }}
                    >
                      Resend invitation
                    </Button>
                    <DevAcceptInvite teamId={p.id} />
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <AddNewModal
        open={open}
        onClose={() => setOpen(false)}
        me={me}
        onStudy={(p) => !!onList(p)}
        onAdd={(p) => onAdd(p)}
      />
    </Card>
  )
}

function AddNewModal({ open, onClose, me, onStudy, onAdd }: { open: boolean; onClose: () => void; me: string; onStudy: (p: TeamPerson) => boolean; onAdd: (p: TeamPerson) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [tags, setTags] = useState('')
  const [touched, setTouched] = useState(false)

  const emailOk = EMAIL.test(email.trim())
  const known = emailOk ? findByEmail(email) : undefined
  const nameOk = !!name.trim() || !!known
  const canSubmit = emailOk && nameOk

  const close = () => {
    setName('')
    setEmail('')
    setTags('')
    setTouched(false)
    onClose()
  }

  const submit = () => {
    setTouched(true)
    if (!canSubmit) return
    // An email already on the list, in any case, reuses that person. Nothing is created and their entry is left as it is.
    const { person, existing } = addTeamPerson({ name, email, tags: parseTags(tags) }, me)
    if (onStudy(person)) {
      toast(`${person.name} is already on this study.`)
    } else {
      onAdd(person)
      toast(
        existing
          ? `${person.name} is already on your team list, so no second entry was made. Added to this study.`
          : `Invitation sent to ${person.email}. ${person.name} counts once they accept.`,
      )
    }
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add someone from your team"
      description="They get an email invitation. They’ll be on the list for every study, and count once they accept."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" form="team-add-form" variant="primary" disabled={touched && !canSubmit} data-testid="team-add-submit">
            Add and invite
          </Button>
        </>
      }
    >
      <form
        id="team-add-form"
        className="flex flex-col gap-4 pb-1"
        data-testid="team-add-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Menon" autoComplete="off" error={touched && !nameOk ? 'Enter a name.' : undefined} />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="priya@company.com"
          autoComplete="off"
          error={touched && !emailOk ? 'Enter a valid email.' : undefined}
          hint={known ? `Already in your team list as ${known.name}. They’ll be added to this study, and their entry stays as it is.` : undefined}
        />
        <TextField label="Expertise tags (optional)" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Skincare, Concept testing" autoComplete="off" hint="Separate with commas." />
        <div className="-mt-2 flex flex-wrap gap-1.5" aria-label="Suggested expertise" data-testid="expertise-suggestions">
          {EXPERTISE_TAGS.map((t) => (
            <button key={t} type="button" onClick={() => setTags(parseTags(`${tags}, ${t}`).join(', '))} className="rounded-full border border-mist px-2.5 py-0.5 text-xs text-graphite hover:bg-haze">
              {t}
            </button>
          ))}
        </div>
      </form>
    </Modal>
  )
}
