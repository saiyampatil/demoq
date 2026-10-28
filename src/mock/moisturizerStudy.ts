import { people } from './people'
import type { StudyRecord } from './types'

export const MOISTURIZER_ID = 'moisturizer-concept'

const base: Omit<StudyRecord, 'status' | 'brief' | 'audience' | 'guide' | 'updatedAt'> = {
  id: MOISTURIZER_ID,
  name: 'Moisturizer Concept Study',
  client: 'Verdane Skincare',
  category: 'Skincare: facial moisturizer',
  moderatorType: 'AI-led',
  interviewLanguage: 'English (US)',
  targetCompletes: 24,
  completedSessions: 0,
}

const briefApproved = {
  status: 'Approved',
  version: 3,
  approval: {
    by: people.researcher.name,
    onBehalfOf: `${people.client.name} (client)`,
    at: '2026-10-14T16:05:00-04:00',
    version: 3,
  },
} as const

const audienceConfirmed = {
  status: 'Confirmed',
  version: 2,
  approval: { by: people.researcher.name, at: '2026-10-17T11:20:00-04:00', version: 2 },
} as const

export type StagePresetKey = 'new' | 'brief-approved' | 'midway' | 'ready' | 'live'

export type StagePreset = { key: StagePresetKey; label: string; description: string; study: StudyRecord }

// The Study stage picker in the dev menu. "New study" is the default after Reset seed.
export const stagePresets: StagePreset[] = [
  {
    key: 'new',
    label: 'New study',
    description: 'Empty brief. Every step after Brief is locked.',
    study: {
      ...base,
      status: 'Not Ready',
      updatedAt: '2026-10-28T09:00:00-04:00',
      brief: { status: null, version: 0 },
      audience: { status: null, version: 0 },
      guide: { status: null, version: 0 },
    },
  },
  {
    key: 'brief-approved',
    label: 'Brief approved',
    description: 'Brief Approved v3. Audience unlocked, AI draft not yet confirmed.',
    study: {
      ...base,
      status: 'Not Ready',
      updatedAt: '2026-10-15T10:30:00-04:00',
      brief: briefApproved,
      audience: { status: 'Draft', version: 1 },
      guide: { status: null, version: 0 },
    },
  },
  {
    key: 'midway',
    label: 'Mid-way: guide in review',
    description: 'Brief Approved v3, audience Confirmed, guide In Review v2. Launch locked.',
    study: {
      ...base,
      status: 'Not Ready',
      updatedAt: '2026-10-24T15:45:00-04:00',
      brief: briefApproved,
      audience: audienceConfirmed,
      guide: { status: 'In Review', version: 2 },
    },
  },
  {
    key: 'ready',
    label: 'Guide approved',
    description: 'Guide Approved v3. Launch unlocked, study Ready to Launch.',
    study: {
      ...base,
      status: 'Ready to Launch',
      updatedAt: '2026-10-27T13:10:00-04:00',
      brief: briefApproved,
      audience: audienceConfirmed,
      guide: {
        status: 'Approved',
        version: 3,
        approval: {
          by: people.researcher.name,
          onBehalfOf: `${people.client.name} (client)`,
          at: '2026-10-27T12:55:00-04:00',
          version: 3,
        },
      },
    },
  },
  {
    key: 'live',
    label: 'Live in fieldwork',
    description: 'Launched on release 1. Fieldwork and Review unlocked.',
    study: {
      ...base,
      status: 'Live',
      releaseVersion: 'Release 1',
      completedSessions: 5,
      updatedAt: '2026-11-03T09:40:00-05:00',
      brief: briefApproved,
      audience: audienceConfirmed,
      guide: {
        status: 'Approved',
        version: 3,
        approval: { by: people.researcher.name, at: '2026-10-27T12:55:00-04:00', version: 3 },
      },
    },
  },
]

export const DEFAULT_STAGE: StagePresetKey = 'new'

export function presetStudy(key: StagePresetKey): StudyRecord {
  return structuredClone((stagePresets.find((p) => p.key === key) ?? stagePresets[0]).study)
}
