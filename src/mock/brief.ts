import { AI_NAME, SECTION_KEYS, snapAll, type BriefDoc, type Sections } from '@/state/brief'
import { completeSections, sampleByKey } from './briefSamples'
import { people } from './people'

// The Moisturizer study's brief for every stage after "New study":
// v1 AI draft, shared, client asked for changes, v2 reopened, v3 edited, shared, approved by client.

const maya = people.researcher.name
const erin = people.client.name

const v1At = '2026-10-06T14:20:00-04:00'
const v3At = '2026-10-13T10:05:00-04:00'

const objectiveV3 =
  'Find out which of the three HydraVeil 72h concept directions makes women with dry or combination skin want to switch from their current moisturizer, and what would stop them switching. Learn whether the refill format reads as premium or cheap. Findings feed Verdane’s January range review.'

export function seedApprovedBrief(studyId: string): BriefDoc {
  const sample = sampleByKey.complete
  const v1: Sections = Object.fromEntries(
    SECTION_KEYS.map((k) => [k, { ...completeSections[k], lastEdited: { by: AI_NAME, at: v1At } }]),
  ) as Sections
  const v3: Sections = { ...v1, objective: { ...v1.objective, text: objectiveV3, lastEdited: { by: maya, at: v3At } } }

  return {
    studyId,
    sampleKey: 'complete',
    original: sample.original,
    previousResearch: sample.previousResearch,
    chat: [
      { id: 'm-1', at: '2026-10-06T14:14:00-04:00', role: 'researcher', kind: 'text', text: sample.original.text },
      { id: 'm-2', at: '2026-10-06T14:15:00-04:00', role: 'ai', kind: 'step', step: 'extract', detail: 'Found 7 of 7 sections in the input.', items: ['In the input: all seven sections', 'Previous research is mentioned. It stays in the original input.'] },
      { id: 'm-3', at: v1At, role: 'ai', kind: 'step', step: 'draft', detail: 'Drafted the brief as version 1.' },
      { id: 'm-4', at: v1At, role: 'ai', kind: 'drafted' },
    ],
    pending: [],
    extracted: structuredClone(completeSections),
    followUps: [],
    intakeComplete: true,
    draft: v3,
    versions: [
      { number: 1, sections: snapAll(v1), savedBy: AI_NAME, savedAt: v1At, note: 'AI draft from intake' },
      { number: 2, sections: snapAll(v1), savedBy: maya, savedAt: '2026-10-09T11:30:00-04:00', note: `Reopened after ${erin} requested changes to version 1` },
      { number: 3, sections: snapAll(v3), savedBy: maya, savedAt: v3At, note: 'Edited Research objective' },
    ],
    status: 'Approved',
    reviewRequests: [],
    approval: { by: maya, at: '2026-10-14T16:05:00-04:00', version: 3, method: 'Client', client: erin },
    events: [
      { id: 'e-1', type: 'saved', at: v1At, by: AI_NAME, version: 1, note: 'AI draft from intake' },
      { id: 'e-2', type: 'shared', at: '2026-10-07T09:10:00-04:00', by: maya, version: 1 },
      {
        id: 'e-3',
        type: 'changes-requested',
        at: '2026-10-09T11:30:00-04:00',
        by: maya,
        version: 1,
        client: erin,
        feedback: 'Please say the findings feed the January range review. That’s what my director will ask.',
      },
      { id: 'e-4', type: 'saved', at: '2026-10-09T11:30:00-04:00', by: maya, version: 2, note: `Reopened after ${erin} requested changes to version 1` },
      { id: 'e-5', type: 'saved', at: v3At, by: maya, version: 3, note: 'Edited Research objective' },
      { id: 'e-6', type: 'shared', at: '2026-10-13T10:20:00-04:00', by: maya, version: 3 },
      { id: 'e-7', type: 'approved', at: '2026-10-14T16:05:00-04:00', by: maya, version: 3, method: 'Client', client: erin },
    ],
  }
}
