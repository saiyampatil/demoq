// Status vocabularies from CLAUDE.md, names used exactly.
// The same name always maps to the same family, whichever vocabulary it comes from.

export const vocabularies = {
  artifact: ['Draft', 'In Review', 'Approved'],
  screening: ['Eligible', 'Ineligible', 'Needs Review', 'Reserve'],
  verification: ['Not started', 'Pending', 'Passed', 'Failed'],
  study: ['Not Ready', 'Ready to Launch', 'Live', 'Paused', 'Terminated', 'Complete'],
  access: ['Invited', 'Opened', 'Consented', 'No-show'],
  session: [
    'Active',
    'Paused',
    'Incomplete (resumable)',
    'Rescheduled',
    'Withdrawn',
    'Technical Error',
    'Completed',
  ],
  review: ['Under review', 'Accepted', 'Excluded'],
  task: ['Completed', 'Completed with fallback', 'Skipped', 'Incomplete'],
  // Not in CLAUDE.md's list; see docs/OPEN_QUESTIONS.md #1
  audience: ['Draft', 'Confirmed'],
} as const

export const vocabularyLabels: Record<keyof typeof vocabularies, string> = {
  artifact: 'Brief and guide',
  screening: 'Applicant screening outcome',
  verification: 'Applicant verification',
  study: 'Study',
  access: 'Access track',
  session: 'Session track',
  review: 'Review track',
  task: 'Task',
  audience: 'Audience definition',
}

export type ArtifactStatus = (typeof vocabularies.artifact)[number]
export type StudyStatus = (typeof vocabularies.study)[number]
export type AudienceStatus = (typeof vocabularies.audience)[number]
export type Status = (typeof vocabularies)[keyof typeof vocabularies][number]

export type StatusFamily = 'neutral' | 'pending' | 'progress' | 'positive' | 'negative' | 'held'

export const familyMeaning: Record<StatusFamily, string> = {
  neutral: 'Not started',
  pending: 'Waiting on someone',
  progress: 'In progress',
  positive: 'Done',
  negative: 'Stopped or failed',
  held: 'Set aside but kept',
}

export const statusFamily: Record<Status, StatusFamily> = {
  Draft: 'neutral',
  'Not started': 'neutral',
  'Not Ready': 'neutral',
  Invited: 'neutral',

  'In Review': 'pending',
  Pending: 'pending',
  'Needs Review': 'pending',
  Paused: 'pending',
  'Under review': 'pending',
  Rescheduled: 'pending',

  Live: 'progress',
  Active: 'progress',
  Opened: 'progress',
  Consented: 'progress',
  'Ready to Launch': 'progress',

  Approved: 'positive',
  Confirmed: 'positive',
  Eligible: 'positive',
  Passed: 'positive',
  Completed: 'positive',
  Accepted: 'positive',
  Complete: 'positive',

  Ineligible: 'negative',
  Failed: 'negative',
  Terminated: 'negative',
  'Technical Error': 'negative',
  Excluded: 'negative',
  Withdrawn: 'negative',
  'No-show': 'negative',
  Incomplete: 'negative',

  Reserve: 'held',
  'Incomplete (resumable)': 'held',
  Skipped: 'held',
  'Completed with fallback': 'held',
}
