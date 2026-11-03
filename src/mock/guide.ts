import { draftGuide, emptyModerator, type GuideDoc, type Stimulus, type Survey } from '@/state/guide'
import { approvedBriefSections } from '@/state/audience'
import type { BriefDoc } from '@/state/brief'
import { uid } from '@/state/brief'
import { people } from './people'

const maya = people.researcher.name
const erin = people.client.name

export const seedSurveys: Survey[] = [
  {
    id: 'sv-intent',
    text: 'After seeing the concept, how likely would you be to buy it?',
    options: ['Definitely would not', 'Probably would not', 'Might or might not', 'Probably would', 'Definitely would'],
  },
  { id: 'sv-scent', text: 'Which scent direction do you prefer?', options: ['Fragrance-free', 'Light floral', 'Fresh citrus', 'Soft musk'] },
]

export const seedStimuli: Stimulus[] = [
  { id: 'st-a', name: 'Concept A: 72-hour hydration', kind: 'concept', detail: '1 page', active: true, addedAt: '2026-10-19T10:00:00-04:00', addedBy: maya },
  { id: 'st-b', name: 'Concept B: Refillable jar', kind: 'concept', detail: '1 page', active: true, addedAt: '2026-10-19T10:02:00-04:00', addedBy: maya },
  { id: 'st-c', name: 'Concept C: Barrier repair', kind: 'concept', detail: '1 page', active: true, addedAt: '2026-10-19T10:04:00-04:00', addedBy: maya },
  { id: 'st-v', name: 'Texture demo, 15 seconds', kind: 'video', detail: 'MP4, 8.4 MB', active: false, addedAt: '2026-10-20T09:30:00-04:00', addedBy: maya },
]

/** A configured AI study with a drafted guide. `approved` also records the approval and the history behind it. */
export function seedGuideDoc(studyId: string, brief: BriefDoc, kind: 'in-review' | 'approved', variant?: 'media-issue' | 'compile-error'): GuideDoc {
  const moderator = { ...emptyModerator(), mode: 'ai' as const, agentId: 'ava', style: 'warm' as const, durationMin: 20, surveys: seedSurveys }
  const stimuli = { items: structuredClone(seedStimuli), skipped: false }
  if (variant === 'media-issue') stimuli.items = stimuli.items.map((s) => (s.id === 'st-b' ? { ...s, renderOk: false } : s))
  const sections = approvedBriefSections(brief)?.sections
  const guide = draftGuide({
    study: { client: 'Verdane Skincare', category: 'Skincare: facial moisturizer' },
    briefSections: sections,
    briefVersion: approvedBriefSections(brief)?.version ?? 3,
    audienceVersion: 2,
    moderator,
    stimuli,
  })
  guide.generatedAt = '2026-10-21T14:00:00-04:00'
  // A defect that slipped past approval: a question shows a stimulus that was deselected afterwards.
  if (variant === 'compile-error') {
    const q = guide.sections.flatMap((x) => x.questions).find((x) => x.stimulusId)
    if (q) q.stimulusId = 'st-v'
  }
  const ev = (at: string, by: string, version: number, type: GuideDocEventType, extra: { note?: string; feedback?: string } = {}) => ({ id: uid('ge'), at, by, version, type, ...extra })
  const base: GuideDoc = {
    studyId,
    moderator,
    stimuli,
    guide,
    status: 'In Review',
    version: 2,
    edits: 0,
    events: [
      ev('2026-10-21T14:00:00-04:00', 'PulseAI', 1, 'drafted'),
      ev('2026-10-22T09:30:00-04:00', maya, 1, 'shared'),
      ev('2026-10-23T11:00:00-04:00', maya, 1, 'changes-requested', {
        note: `Requested by ${erin}`,
        feedback: 'Please make sure we ask about the refill format directly. My director cares about whether it reads as premium.',
      }),
      ev('2026-10-23T11:00:00-04:00', maya, 2, 'reopened', { note: 'Version 2 opened for the client’s changes. Version 1 is frozen.' }),
      ev('2026-10-24T15:45:00-04:00', maya, 2, 'shared'),
    ],
  }
  if (kind === 'in-review') return base
  return {
    ...base,
    status: 'Approved',
    version: 3,
    approved: { version: 3, by: maya, at: '2026-10-27T12:55:00-04:00', onBehalfOf: `${erin} (client)` },
    events: [
      ...base.events,
      ev('2026-10-26T10:10:00-04:00', maya, 3, 'reopened', { note: 'Added a probe on refill pricing. Version 2 is frozen.' }),
      ev('2026-10-27T12:30:00-04:00', erin, 3, 'client-approved', { note: erin }),
      ev('2026-10-27T12:55:00-04:00', maya, 3, 'approved', { note: `Client ${erin} approved` }),
    ],
  }
}

type GuideDocEventType = GuideDoc['events'][number]['type']
