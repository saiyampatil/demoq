// Status vocabularies from CLAUDE.md, names used exactly.
// The same name always maps to the same family, whichever vocabulary it comes from.

export const vocabularies = {
  artifact: ['Draft', 'In Review', 'Approved'],
  screening: ['Eligible', 'Ineligible', 'Needs Review', 'Reserve'],
  verification: ['Not started', 'Pending', 'Passed', 'Failed'],
  study: ['Not Ready', 'Ready to Launch', 'Live', 'Paused', 'Terminated', 'Complete'],
  access: ['Invited', 'Opened', 'Consented', 'No-show'],
  session: [
    'Not started',
    'Booked',
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
  clientReview: ['Sent', 'Viewed', 'Approved', 'Declined'],
  // Launch (4.1): test runs and preflight checks. Not in CLAUDE.md's list.
  testRun: ['Not run', 'In progress', 'Completed', 'Issues found'],
  preflight: ['Passed', 'Failed', 'Overridden'],
  // Not in CLAUDE.md's list; see docs/OPEN_QUESTIONS.md #1
  audience: ['Draft', 'Confirmed'],
  // Results Analysis (docs/ANALYSIS_PLAN.md). "Approved" comes from the brief and guide vocabulary.
  analysis: ['Ready to approve', 'Needs re-approval'],
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
  clientReview: 'Client review (per recipient)',
  testRun: 'Test run (launch)',
  preflight: 'Preflight check (launch)',
  audience: 'Audience definition',
  analysis: 'Analysis base',
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
  'Not run': 'neutral',

  'In Review': 'pending',
  Pending: 'pending',
  'Needs Review': 'pending',
  Paused: 'pending',
  'Under review': 'pending',
  Rescheduled: 'pending',
  Booked: 'pending',
  Sent: 'pending',
  'Ready to approve': 'pending',
  'Needs re-approval': 'pending',

  Live: 'progress',
  Active: 'progress',
  Opened: 'progress',
  Consented: 'progress',
  Viewed: 'progress',
  'In progress': 'progress',
  'Ready to Launch': 'progress',

  Approved: 'positive',
  Confirmed: 'positive',
  Eligible: 'positive',
  Passed: 'positive',
  Completed: 'positive',
  Accepted: 'positive',
  Complete: 'positive',

  Ineligible: 'negative',
  Declined: 'negative',
  Failed: 'negative',
  Terminated: 'negative',
  'Technical Error': 'negative',
  Excluded: 'negative',
  Withdrawn: 'negative',
  'Issues found': 'negative',
  'No-show': 'negative',
  Incomplete: 'negative',

  Reserve: 'held',
  'Incomplete (resumable)': 'held',
  Skipped: 'held',
  Overridden: 'held',
  'Completed with fallback': 'held',
}
