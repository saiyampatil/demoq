import {
  AI_NAME,
  type BriefDoc,
} from '@/state/brief'
import {
  approvedBriefSections,
  cohortNameFrom,
  draftFromBrief,
  emptySourcing,
  generateQuestions,
  STANDARD_EXCLUSIONS,
  type AudienceDef,
  type Candidate,
  type AudienceDoc,
  type Filter,
} from '@/state/audience'
import { seedReward } from '@/state/reward'
import { mockApplicants, poolView } from '@/state/screening'
import { people } from './people'

// Module 2 seeds for the Study stage picker.
// "Brief approved": the AI draft, not confirmed.
// "Mid-way" and later: a confirmed audience of one cohort (24 interviews), a ready screener and invited sources.

const maya = people.researcher.name

export function seedDraftAudience(studyId: string, brief: BriefDoc): AudienceDoc | undefined {
  const approved = approvedBriefSections(brief)
  if (!approved) return undefined
  return {
    studyId,
    briefVersion: approved.version,
    pending: [],
    def: draftFromBrief(approved.sections),
    status: 'Draft',
    version: 1,
    events: [{ id: 'ae-1', at: '2026-10-15T09:40:00-04:00', by: AI_NAME, version: 1, type: 'drafted' }],
    screener: null,
    sourcing: emptySourcing(),
  }
}

let n = 0
const f = (field: Filter['field'], value: string, origin: Filter['origin'] = 'ai', extra: Partial<Filter> = {}): Filter => ({
  id: `sf-${++n}`,
  field,
  value,
  origin,
  ...extra,
})

const confirmedDef = (): AudienceDef => {
  const filters = [
    f('gender', 'Female'),
    f('age', '', 'edited', { min: '25', max: '44' }),
    f('country', 'United States'),
    f('skinType', 'Dry or combination'),
    f('productUsage', 'Uses a facial moisturizer daily'),
  ]
  return {
    total: 24,
    totalOrigin: 'ai',
    bufferPct: 15,
    cohort: { id: 'c-main', name: cohortNameFrom(filters), nameOrigin: 'ai', filters, missing: [] },
    exclusions: STANDARD_EXCLUSIONS.map((e, i) => ({ id: `ex-${i + 1}`, ...e })),
  }
}

export function seedConfirmedAudience(studyId: string): AudienceDoc {
  const def = confirmedDef()
  const invited = '2026-10-18T10:15:00-04:00'
  return {
    studyId,
    briefVersion: 3,
    pending: [],
    def,
    status: 'Confirmed',
    version: 2,
    confirmed: { version: 2, by: maya, at: '2026-10-17T11:20:00-04:00', def: structuredClone(def) },
    events: [
      { id: 'ae-1', at: '2026-10-15T09:40:00-04:00', by: AI_NAME, version: 1, type: 'drafted' },
      { id: 'ae-2', at: '2026-10-16T14:05:00-04:00', by: maya, version: 1, type: 'confirmed' },
      { id: 'ae-3', at: '2026-10-17T10:50:00-04:00', by: maya, version: 2, type: 'reopened' },
      { id: 'ae-4', at: '2026-10-17T11:20:00-04:00', by: maya, version: 2, type: 'confirmed' },
    ],
    screener: {
      status: 'Ready',
      questions: generateQuestions(def),
      generatedAt: '2026-10-17T11:30:00-04:00',
      fromAudienceVersion: 2,
      accepted: { by: maya, at: '2026-10-18T09:00:00-04:00' },
    },
    reward: seedReward('United States', 40, 20, maya, '2026-10-18T09:00:00-04:00'),
    sourcing: {
      option: 'external',
      panelName: 'Northstar Consumer Panel (mock)',
      candidates: [
        ...Array.from({ length: 6 }, (_, i): Candidate => ({ id: `cd-m${i + 1}`, value: `usr_${48101 + i * 13}`, idType: 'userId', source: 'Manual', addedAt: '2026-10-18T09:20:00-04:00', invitedAt: invited })),
        ...Array.from({ length: 22 }, (_, i): Candidate => ({ id: `cd-e${i + 1}`, value: `NS-${48210 + i * 7}`, idType: 'userId', source: 'External', addedAt: '2026-10-18T09:25:00-04:00', invitedAt: invited })),
      ],
    },
  }
}

/** The confirmed audience with its pool confirmed, for the launch stages. */
export function seedAudienceWithPool(studyId: string): AudienceDoc {
  const doc = seedConfirmedAudience(studyId)
  const view = poolView(mockApplicants(doc), doc)
  const members = view.members.map((m) => ({ applicantId: m.id }))
  const shortfall = view.members.length < view.need ? { have: view.members.length, need: view.need } : null
  return { ...doc, pool: { at: '2026-10-26T16:20:00-04:00', by: maya, members, shortfall } }
}
