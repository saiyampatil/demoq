// Status vocabularies from CLAUDE.md, names used exactly.
// The same name always maps to the same family, whichever vocabulary it comes from.

export const vocabularies = {
  artifact: ['Draft', 'In Review', 'Approved'],
  screening: ['Eligible', 'Ineligible', 'Pending review'],
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
  // Moderators in R12. Invited and Declined come from the other vocabularies. "Added" is how a moderator who counts is
  // shown (stored as Accepted). "Requested" only appears on studies saved before requests were removed.
  moderator: ['Requested', 'Added'],
  // Codes in the Results Analysis codebook (docs/ANALYSIS_PLAN.md). Not in CLAUDE.md's list.
  code: ['Suggested', 'Accepted', 'Rejected', 'Merged'],
  // Tensions in Emotion & behaviour. "Suggested" is shared with codes. Not in CLAUDE.md's list.
  tension: ['Added as a tension theme', 'Dismissed'],
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
  moderator: 'Moderator (R12)',
  code: 'Codebook code (analysis)',
  tension: 'Tension (analysis)',
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
  Requested: 'pending',
  Pending: 'pending',
  'Pending review': 'pending',
  Paused: 'pending',
  'Under review': 'pending',
  Rescheduled: 'pending',
  Booked: 'pending',
  Sent: 'pending',
  Suggested: 'pending',

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
  Added: 'positive',
  'Added as a tension theme': 'positive',
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
  Rejected: 'negative',

  'Incomplete (resumable)': 'held',
  Skipped: 'held',
  Overridden: 'held',
  Merged: 'held',
  Dismissed: 'held',
  'Completed with fallback': 'held',
}
