import type { ArtifactStatus, AudienceStatus, StudyStatus } from '@/components/status'

export type Person = {
  id: string
  name: string
  role: 'Researcher' | 'Human moderator' | 'End Client'
  title: string
  organization: string
  email: string
}

/** Who approved or confirmed what, when, and which version. */
export type Approval = {
  by: string
  /** Recorded by the Researcher on someone's behalf, e.g. "Approved by client". */
  onBehalfOf?: string
  at: string
  version: number
}

/** Where an emailed brief stands with the client. Shown on R0 and in the stepper. */
export type ClientReviewSummary = {
  state: 'Waiting' | 'Commented' | 'Approved' | 'Declined'
  recipients: number
  comments: number
}

export type TrackedArtifact<S> = {
  /** null until work on it has started. */
  status: S | null
  version: number
  approval?: Approval
  clientReview?: ClientReviewSummary
}

export type StudyRecord = {
  id: string
  name: string
  client: string
  /** Who at the client reviews the brief and watches from the backroom. Shown in study governance. */
  clientContact?: string
  category: string
  moderatorType: 'AI-led' | 'Human-led'
  interviewLanguage: string
  targetCompletes: number
  completedSessions: number
  /** IANA time zone every timestamp is shown in. Edited in Study settings (R23). Defaults to Eastern. */
  timeZone?: string
  updatedAt: string
  status: StudyStatus
  brief: TrackedArtifact<ArtifactStatus>
  audience: TrackedArtifact<AudienceStatus>
  guide: TrackedArtifact<ArtifactStatus>
  /** Set when launch is authorized and the release is locked. */
  releaseVersion?: string
}
