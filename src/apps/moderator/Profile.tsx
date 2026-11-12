import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { TextField } from '@/components/Field'
import { useToast } from '@/components/Toast'
import { EXPERTISE_TAGS } from '@/mock/expertise'
import { editProfile } from '@/state/moderatorProfiles'
import { updateTeamPerson } from '@/state/teamModerators'
import { zoneLabel } from '@/state/zone'
import { PageHeader } from '../shared/PageHeader'
import { useModerator } from './useModerator'

/**
 * M4: who the moderator is. Name and expertise are theirs to edit; the email came with the invitation and doesn't change.
 * The time zone is the one their availability is shown in, set from their device, so it is shown and not edited here.
 * Expertise is picked from the one shared list the Researcher's "Add new" pop-up suggests from.
 */
export function ModeratorProfile() {
  const { me } = useModerator()
  const toast = useToast()
  const [name, setName] = useState(me.name)
  const [tags, setTags] = useState<string[]>(me.tags)
  useEffect(() => {
    setName(me.name)
    setTags(me.tags)
  }, [me.id, me.name, me.tags])

  if (me.kind === 'invited')
    return (
      <div className="flex flex-col gap-3">
        <PageHeader id="M4" title="Profile" description="Accept your invitation first." />
      </div>
    )
  const dirty = name.trim() !== me.name || tags.join('|') !== me.tags.join('|')
  // A tag someone already has that isn't in the shared list stays selectable, so saving never drops it.
  const options = [...EXPERTISE_TAGS, ...me.tags.filter((t) => !(EXPERTISE_TAGS as readonly string[]).includes(t))]
  const save = () => {
    if (!name.trim()) return
    if (me.kind === 'team') updateTeamPerson(me.id, { name, tags })
    else editProfile(me.id, { name, tags })
    toast('Profile saved.')
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6" data-testid="profile">
      <PageHeader id="M4" title="Profile" description="How you appear to Researchers and participants, and what you are known for." />
      <div className="flex flex-col gap-5 rounded-md border border-mist bg-surface p-5">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={name.trim() ? undefined : 'A name is needed.'} autoComplete="off" />
        <TextField label="Email" value={me.email} readOnly disabled hint="From your invitation. It can’t be changed here." />
        <div>
          <p className="text-sm font-medium">Time zone</p>
          <p className="mt-1 text-sm" data-testid="profile-zone">
            {zoneLabel(me.timeZone)}
          </p>
          <p className="text-xs text-graphite">Your availability is shown in this zone. It comes from your device.</p>
        </div>
        {me.company && (
          <div>
            <p className="text-sm font-medium">Company</p>
            <p className="mt-1 text-sm">{me.company}</p>
            <p className="text-xs text-graphite">You see this company’s studies only.</p>
          </div>
        )}
        <fieldset>
          <legend className="text-sm font-medium">Expertise</legend>
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="expertise-tags">
            {options.map((t) => {
              const on = tags.includes(t)
              return (
                <button key={t} type="button" aria-pressed={on} data-tag={t} onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))} className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-iris-600 bg-iris-50 font-medium text-iris-700' : 'border-mist text-graphite hover:bg-haze')}>
                  {t}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div className="flex items-center gap-3">
          <Button variant="primary" disabled={!dirty || !name.trim()} onClick={save} data-testid="profile-save">
            Save profile
          </Button>
          {!dirty && <span className="text-xs text-graphite">Nothing to save.</span>}
        </div>
      </div>
    </div>
  )
}
