// R12: adding and removing moderators. There are no requests: every option adds the person at once. Only someone new
// from the team list is Invited, and they count once they accept (state/teamModerators.ts).
// Each function takes a doc and returns a new one. Adding or removing is a setup edit, so on an approved guide it makes
// the next version, like any other edit. A person accepting later is not an edit and never does.
import { HUMAN_MODERATORS } from '@/mock/moderation'
import { editModerator, standbyOf, teamOf, withTeam, type GuideDoc, type TeamMember } from './guide'
import { now, uid } from './brief'
import type { TeamPerson } from './teamModerators'

/** `team` interviews in a human-led study. `standby` takes a participant who asks for a person in an AI-led one, and never joins the interview team. */
export type Where = 'team' | 'standby'

const listOf = (doc: GuideDoc, where: Where) => (where === 'team' ? teamOf(doc.moderator) : standbyOf(doc.moderator))

function put(doc: GuideDoc, by: string, where: Where, member: TeamMember, note: string): GuideDoc {
  return editModerator(
    doc,
    by,
    (m) => (where === 'team' ? withTeam(m, [...teamOf(m), member]) : { ...m, standby: [...standbyOf(m), member] }),
    note,
  )
}

const noun = (where: Where) => (where === 'team' ? 'a moderator' : 'a standby moderator')

/** "I'll moderate" / "I'll be on standby": the current user, added at once. */
export function addMe(doc: GuideDoc, by: string, where: Where, language: string): GuideDoc {
  if (listOf(doc, where).some((t) => t.source === 'Myself')) return doc
  const member: TeamMember = { id: uid(where === 'team' ? 'mod' : 'sb'), name: by, source: 'Myself', language, status: 'Accepted', weeklyHours: 8, by, sentAt: now() }
  return put(doc, by, where, member, where === 'team' ? 'Added themselves as a moderator' : 'Added themselves on standby')
}

/** A PulseAI moderator from the fixed roster, added at once and counted at once. The Researcher can't create or edit one. */
export function addPulse(doc: GuideDoc, by: string, where: Where, rosterId: string, language: string): GuideDoc {
  const h = HUMAN_MODERATORS.find((x) => x.id === rosterId)
  if (!h || listOf(doc, where).some((t) => t.rosterId === rosterId)) return doc
  const member: TeamMember = { id: uid(where === 'team' ? 'mod' : 'sb'), name: h.name, source: 'PulseAI', language, status: 'Accepted', weeklyHours: h.weeklyHours, rosterId, by, sentAt: now() }
  return put(doc, by, where, member, `Added ${h.name}${where === 'standby' ? ' on standby' : ''}`)
}

/**
 * Someone from the company's team list. They are Added if they are Active there, and Invited if not (their status is
 * read live, so the first acceptance counts them in every study they are on).
 */
export function addTeamPersonToStudy(doc: GuideDoc, by: string, where: Where, person: TeamPerson, language: string): GuideDoc {
  if (listOf(doc, where).some((t) => t.teamId === person.id)) return doc
  const member: TeamMember = {
    id: uid(where === 'team' ? 'mod' : 'sb'),
    name: person.name,
    email: person.email,
    source: 'My team',
    language,
    status: person.status === 'Active' ? 'Accepted' : 'Invited',
    weeklyHours: 6,
    teamId: person.id,
    by,
    sentAt: now(),
  }
  return put(doc, by, where, member, `Added ${person.name} as ${noun(where)}`)
}

export function removeFrom(doc: GuideDoc, by: string, where: Where, id: string): GuideDoc {
  if (!listOf(doc, where).some((t) => t.id === id)) return doc
  return editModerator(
    doc,
    by,
    (m) => (where === 'team' ? withTeam(m, teamOf(m).filter((t) => t.id !== id)) : { ...m, standby: standbyOf(m).filter((t) => t.id !== id) }),
    where === 'team' ? 'Removed a moderator' : 'Removed a standby moderator',
  )
}
