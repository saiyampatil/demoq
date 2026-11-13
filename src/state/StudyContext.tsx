import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyLiveDemo } from '@/mock/liveDemo'
import { seedAudienceWithPool, seedConfirmedAudience, seedDraftAudience } from '@/mock/audience'
import { seedGuideDoc } from '@/mock/guide'
import { seedLaunchDoc } from '@/mock/launch'
import { seedApprovedBrief } from '@/mock/brief'
import { DEFAULT_STAGE, MOISTURIZER_ID, presetStudy, type StagePresetKey } from '@/mock/moisturizerStudy'
import { otherStudies } from '@/mock/studies'
import { PET_ID, PET_RECORD, seedPetFood } from '@/mock/petFood'
import type { StudyRecord } from '@/mock/types'
import { audienceSummary, emptySourcing, migrateAudience, type AudienceDoc } from './audience'
import { briefSummary, now, type BriefDoc } from './brief'
import { acceptedRoster, guideSummary, withTeam, type GuideDoc } from './guide'
import { DEFAULT_TIME_ZONE } from '@/lib/timeZone'
import { assignPlans, generateFieldwork, SESSION_SEED, type FieldworkDoc } from './fieldwork'
import { seedModerators } from '@/mock/moderatorSeed'
import { resetReview } from './reviewState'
import { resetCodebook } from './codebook'
import { studyLanguage } from './language'
import { compileStudyPlan, emptyLaunchDoc, readiness, type LaunchDoc } from './launch'
import { resetTeamModerators, useTeamModerators } from './teamModerators'

const STORAGE_KEY = 'pulseai-qual:v2'

type Persisted = {
  stage: StagePresetKey
  moisturizer: StudyRecord
  /** Pet Food Subscription Churn, a finished study. */
  pet: StudyRecord
  /** Studies created with "New study", newest first. */
  created: StudyRecord[]
  briefs: Record<string, BriefDoc>
  audiences: Record<string, AudienceDoc>
  guides: Record<string, GuideDoc>
  launches: Record<string, LaunchDoc>
  fieldworks: Record<string, FieldworkDoc>
}

type StudyContextValue = {
  studies: StudyRecord[]
  getStudy: (id: string | undefined) => StudyRecord | undefined
  /** Only the seed study and created studies can be edited; the other dashboard studies are read-only. */
  isEditable: (id: string | undefined) => boolean
  createStudy: (name: string) => StudyRecord
  getBrief: (id: string | undefined) => BriefDoc | undefined
  /** The study language, read from the brief's market. The only place it is read from. */
  getLanguage: (id: string | undefined) => string | null
  setBrief: (id: string, doc: BriefDoc) => void
  updateBrief: (id: string, fn: (doc: BriefDoc) => BriefDoc) => void
  getAudience: (id: string | undefined) => AudienceDoc | undefined
  setAudience: (id: string, doc: AudienceDoc) => void
  updateAudience: (id: string, fn: (doc: AudienceDoc) => AudienceDoc) => void
  getGuide: (id: string | undefined) => GuideDoc | undefined
  setGuide: (id: string, doc: GuideDoc) => void
  updateGuide: (id: string, fn: (doc: GuideDoc) => GuideDoc) => void
  getLaunch: (id: string | undefined) => LaunchDoc | undefined
  updateLaunch: (id: string, fn: (doc: LaunchDoc) => LaunchDoc) => void
  fieldworks: Record<string, FieldworkDoc>
  getFieldwork: (id: string | undefined) => FieldworkDoc | undefined
  updateFieldwork: (id: string, fn: (doc: FieldworkDoc) => FieldworkDoc) => void
  /** Dev only: switches the seed study between an AI and a human moderator. */
  devSetModerator: (mode: 'ai' | 'human') => void
  stage: StagePresetKey
  setStage: (stage: StagePresetKey) => void
  resetSeed: () => void
}

const StudyContext = createContext<StudyContextValue | null>(null)

function seedStage(stage: StagePresetKey): Pick<Persisted, 'stage' | 'moisturizer' | 'briefs' | 'audiences' | 'guides' | 'launches' | 'fieldworks'> {
  const moisturizer = presetStudy(stage)
  if (stage === 'new') return { stage, moisturizer, briefs: {}, audiences: {}, guides: {}, launches: {}, fieldworks: {} }
  const brief = seedApprovedBrief(MOISTURIZER_ID)
  const launchStage = stage === 'ready' || stage === 'ready-media-issue' || stage === 'compile-error' || stage === 'live' || stage === 'live-demo'
  const audience = stage === 'brief-approved' ? seedDraftAudience(MOISTURIZER_ID, brief) : launchStage ? seedAudienceWithPool(MOISTURIZER_ID) : seedConfirmedAudience(MOISTURIZER_ID)
  const guide =
    stage === 'midway'
      ? seedGuideDoc(MOISTURIZER_ID, brief, 'in-review')
      : stage === 'ready' || stage === 'live' || stage === 'live-demo'
        ? seedGuideDoc(MOISTURIZER_ID, brief, 'approved')
        : stage === 'ready-media-issue'
          ? seedGuideDoc(MOISTURIZER_ID, brief, 'approved', 'media-issue')
          : stage === 'compile-error'
            ? seedGuideDoc(MOISTURIZER_ID, brief, 'approved', 'compile-error')
            : undefined
  const plan = guide ? compileStudyPlan(guide, studyLanguage(brief)) : undefined
  const launch = launchStage ? seedLaunchDoc(MOISTURIZER_ID, stage === 'live' || stage === 'live-demo' ? 'live' : 'ready', moisturizer.client) : undefined
  const generated =
    (stage === 'live' || stage === 'live-demo') && guide && audience && plan?.state === 'ok'
      ? generateFieldwork({ studyId: MOISTURIZER_ID, audience, guide, plan: plan.plan, releaseNumber: 1, releaseVersion: 'Release v1.0', launch })
      : undefined
  const fieldwork = generated && stage === 'live-demo' ? applyLiveDemo(generated, audience) : generated
  return {
    stage,
    moisturizer: { ...moisturizer, brief: briefSummary(brief), ...(audience ? { audience: audienceSummary(audience) } : {}), ...(guide ? { guide: guideSummary(guide) } : {}) },
    briefs: { [MOISTURIZER_ID]: brief },
    audiences: audience ? { [MOISTURIZER_ID]: audience } : {},
    guides: guide ? { [MOISTURIZER_ID]: guide } : {},
    launches: launch ? { [MOISTURIZER_ID]: launch } : {},
    fieldworks: fieldwork ? { [MOISTURIZER_ID]: fieldwork } : {},
  }
}

/** Pet Food Subscription Churn: a finished study with every document filled in. It never changes with the seed study's stage. */
function petState(): Pick<Persisted, 'pet' | 'briefs' | 'audiences' | 'guides' | 'launches' | 'fieldworks'> {
  const p = seedPetFood()
  return {
    pet: { ...PET_RECORD, brief: briefSummary(p.brief), audience: audienceSummary(p.audience), guide: guideSummary(p.guide) },
    briefs: { [PET_ID]: p.brief },
    audiences: { [PET_ID]: p.audience },
    guides: { [PET_ID]: p.guide },
    launches: { [PET_ID]: p.launch },
    fieldworks: { [PET_ID]: p.fieldwork },
  }
}

const freshState = (): Persisted => {
  const seed = seedStage(DEFAULT_STAGE)
  const pet = petState()
  return { ...seed, ...pet, briefs: { ...seed.briefs, ...pet.briefs }, audiences: { ...seed.audiences, ...pet.audiences }, guides: { ...seed.guides, ...pet.guides }, launches: { ...seed.launches, ...pet.launches }, fieldworks: { ...seed.fieldworks, ...pet.fieldworks }, created: [] }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      let parsed = JSON.parse(raw) as Persisted
      if (parsed?.moisturizer?.id === MOISTURIZER_ID && Array.isArray(parsed.created)) {
        // Progress saved before Pet Food Subscription Churn was filled in has none of its documents: add them.
        if (!parsed.pet || !parsed.briefs?.[PET_ID]) {
          const pet = petState()
          parsed = { ...parsed, ...pet, briefs: { ...parsed.briefs, ...pet.briefs }, audiences: { ...parsed.audiences, ...pet.audiences }, guides: { ...parsed.guides, ...pet.guides }, launches: { ...parsed.launches, ...pet.launches }, fieldworks: { ...parsed.fieldworks, ...pet.fieldworks } }
        }
        // Briefs saved before emailed approval existed have no review requests.
        const briefs = Object.fromEntries(Object.entries(parsed.briefs ?? {}).map(([id, doc]) => [id, { ...doc, reviewRequests: doc.reviewRequests ?? [] }]))
        // Sourcing saved before the two-option rework used a link, contacts and a panel list.
        const audiences = Object.fromEntries(
          Object.entries(parsed.audiences ?? {}).map(([id, doc]) => [id, migrateAudience(Array.isArray(doc.sourcing?.candidates) ? doc : { ...doc, sourcing: emptySourcing() })]),
        )
        // Fieldwork saved from an older seed session list is rebuilt, so it matches Review.
        const guides = parsed.guides ?? {}
        const launches = parsed.launches ?? {}
        const fieldworks = Object.fromEntries(
          Object.entries(parsed.fieldworks ?? {}).map(([id, fw]) => {
            if (fw.seed === SESSION_SEED) return [id, fw]
            if (id === PET_ID) return [id, seedPetFood().fieldwork]
            const guide = guides[id]
            const audience = audiences[id]
            const plan = compileStudyPlan(guide, studyLanguage(briefs[id]))
            if (!guide || !audience || plan.state !== 'ok') return [id, fw]
            return [id, { ...generateFieldwork({ studyId: id, audience, guide, plan: plan.plan, releaseNumber: fw.releaseNumber, releaseVersion: fw.releaseVersion, launch: launches[id] }), paused: fw.paused, log: fw.log }]
          }),
        )
        return { ...parsed, briefs, audiences, guides, launches, fieldworks }
      }
    }
  } catch {
    // Storage blocked or corrupt: fall back to the seed.
  }
  return freshState()
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${base || 'study'}-${Math.random().toString(36).slice(2, 6)}`
}

/** The Moderator view's mock data goes onto the fieldwork records wherever they come from: a fresh start, saved progress, a new stage. */
const withSeed = (p: Persisted): Persisted => ({ ...p, fieldworks: seedModerators(p.fieldworks) })

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => withSeed(load()))

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Progress just won't survive a refresh.
    }
  }, [state])

  const setStage = useCallback(
    (stage: StagePresetKey) => {
      // The seed study's review decisions belong to its seed sessions, so a new stage starts them again.
      resetReview()
      setState((prev) => {
        // Changing stage replaces only the seed study; created studies stay.
        const { [MOISTURIZER_ID]: _seedBrief, ...otherBriefs } = prev.briefs
        const { [MOISTURIZER_ID]: _seedAudience, ...otherAudiences } = prev.audiences
        const { [MOISTURIZER_ID]: _seedGuide, ...otherGuides } = prev.guides
        const { [MOISTURIZER_ID]: _seedLaunch, ...otherLaunches } = prev.launches
        const { [MOISTURIZER_ID]: _seedFieldwork, ...otherFieldworks } = prev.fieldworks
        void _seedBrief
        void _seedAudience
        void _seedGuide
        void _seedLaunch
        void _seedFieldwork
        const next = seedStage(stage)
        return withSeed({ ...prev, ...next, briefs: { ...otherBriefs, ...next.briefs }, audiences: { ...otherAudiences, ...next.audiences }, guides: { ...otherGuides, ...next.guides }, launches: { ...otherLaunches, ...next.launches }, fieldworks: { ...otherFieldworks, ...next.fieldworks } })
      })
    },
    [],
  )
  const resetSeed = useCallback(() => {
    resetReview()
    resetCodebook()
    resetTeamModerators()
    setState(withSeed(freshState()))
  }, [])

  const createStudy = useCallback((name: string) => {
    const study: StudyRecord = {
      id: slugify(name),
      name: name.trim(),
      client: 'Client not set',
      category: 'Not set',
      moderatorType: 'AI-led',
      targetCompletes: 0,
      completedSessions: 0,
      timeZone: DEFAULT_TIME_ZONE,
      updatedAt: now(),
      status: 'Not Ready',
      brief: { status: null, version: 0 },
      audience: { status: null, version: 0 },
      guide: { status: null, version: 0 },
    }
    setState((prev) => ({ ...prev, created: [study, ...prev.created] }))
    return study
  }, [])

  const writeBrief = useCallback((id: string, fn: (doc: BriefDoc | undefined) => BriefDoc) => {
    setState((prev) => {
      const doc = fn(prev.briefs[id])
      const sync = (s: StudyRecord) => (s.id === id ? { ...s, brief: briefSummary(doc), updatedAt: now() } : s)
      return { ...prev, briefs: { ...prev.briefs, [id]: doc }, moisturizer: sync(prev.moisturizer), pet: sync(prev.pet), created: prev.created.map(sync) }
    })
  }, [])

  const writeAudience = useCallback((id: string, fn: (doc: AudienceDoc | undefined) => AudienceDoc) => {
    setState((prev) => {
      const doc = fn(prev.audiences[id])
      const sync = (s: StudyRecord) => (s.id === id ? { ...s, audience: audienceSummary(doc), updatedAt: now() } : s)
      return { ...prev, audiences: { ...prev.audiences, [id]: doc }, moisturizer: sync(prev.moisturizer), pet: sync(prev.pet), created: prev.created.map(sync) }
    })
  }, [])
  const setAudience = useCallback((id: string, doc: AudienceDoc) => writeAudience(id, () => doc), [writeAudience])
  const updateAudience = useCallback(
    (id: string, fn: (doc: AudienceDoc) => AudienceDoc) =>
      writeAudience(id, (doc) => {
        if (!doc) throw new Error(`No audience for study ${id}`)
        return fn(doc)
      }),
    [writeAudience],
  )

  const writeGuide = useCallback((id: string, fn: (doc: GuideDoc | undefined) => GuideDoc) => {
    setState((prev) => {
      const doc = fn(prev.guides[id])
      // Choosing AI or human in R12 sets the study's moderator type.
      // Editing what a Live study runs from pauses it: the new version needs approval, then a new release.
      const reopened = prev.guides[id]?.status === 'Approved' && doc.status !== 'Approved'
      const sync = (s: StudyRecord): StudyRecord =>
        s.id === id
          ? {
              ...s,
              guide: guideSummary(doc),
              moderatorType: doc.moderator.mode ? (doc.moderator.mode === 'ai' ? 'AI-led' : 'Human-led') : s.moderatorType,
              status: reopened && s.status === 'Live' ? 'Paused' : s.status,
              updatedAt: now(),
            }
          : s
      return { ...prev, guides: { ...prev.guides, [id]: doc }, moisturizer: sync(prev.moisturizer), pet: sync(prev.pet), created: prev.created.map(sync) }
    })
  }, [])
  const setGuide = useCallback((id: string, doc: GuideDoc) => writeGuide(id, () => doc), [writeGuide])
  const updateGuide = useCallback(
    (id: string, fn: (doc: GuideDoc) => GuideDoc) =>
      writeGuide(id, (doc) => {
        if (!doc) throw new Error(`No guide for study ${id}`)
        return fn(doc)
      }),
    [writeGuide],
  )

  const writeLaunch = useCallback((id: string, fn: (doc: LaunchDoc | undefined) => LaunchDoc) => {
    setState((prev) => {
      const doc = fn(prev.launches[id])
      // Authorizing locks a release and sets the study Live.
      const newRelease = doc.release && doc.release.at !== prev.launches[id]?.release?.at
      const sync = (s: StudyRecord): StudyRecord => (s.id === id ? { ...s, status: newRelease ? 'Live' : s.status, releaseVersion: newRelease ? doc.release!.version : s.releaseVersion, updatedAt: now() } : s)
      // A new release starts fieldwork. Earlier sessions stay tied to the release they ran on.
      let fieldworks = prev.fieldworks
      if (newRelease) {
        const guide = prev.guides[id]
        const audience = prev.audiences[id]
        const plan = compileStudyPlan(guide, studyLanguage(prev.briefs[id]))
        const existing = prev.fieldworks[id]
        // Sessions run so far keep the release and guide they ran under. Only the ones that start from now on use the new one.
        const stamped = existing?.sessions.map((s) => (s.releaseVersion ? s : { ...s, releaseVersion: existing.releaseVersion, guideVersion: existing.plan.guideVersion }))
        if (existing) fieldworks = { ...fieldworks, [id]: { ...existing, sessions: stamped ?? existing.sessions, releaseNumber: doc.release!.number, releaseVersion: doc.release!.version, paused: null, ...(plan.state === 'ok' ? { plan: plan.plan } : {}) } }
        else if (guide && audience && plan.state === 'ok')
          fieldworks = { ...fieldworks, [id]: generateFieldwork({ studyId: id, audience, guide, plan: plan.plan, releaseNumber: doc.release!.number, releaseVersion: doc.release!.version, launch: doc }) }
      }
      return { ...prev, launches: { ...prev.launches, [id]: doc }, fieldworks, moisturizer: sync(prev.moisturizer), pet: sync(prev.pet), created: prev.created.map(sync) }
    })
  }, [])
  const writeFieldwork = useCallback((id: string, fn: (doc: FieldworkDoc | undefined) => FieldworkDoc) => {
    setState((prev) => {
      const before = prev.fieldworks[id]
      const doc = assignPlans(fn(before))
      const paused = !before?.paused && !!doc.paused
      const resumed = !!before?.paused && !doc.paused
      const closed = !before?.closed && !!doc.closed
      const terminated = !before?.terminated && !!doc.terminated
      const completed = doc.sessions.filter((x) => x.status === 'Completed').length
      const sync = (s: StudyRecord): StudyRecord => (s.id === id ? { ...s, completedSessions: completed, status: closed ? 'Complete' : terminated ? 'Terminated' : paused ? 'Paused' : resumed ? 'Live' : s.status, updatedAt: now() } : s)
      return { ...prev, fieldworks: { ...prev.fieldworks, [id]: doc }, moisturizer: sync(prev.moisturizer), pet: sync(prev.pet), created: prev.created.map(sync) }
    })
  }, [])
  const updateFieldwork = useCallback(
    (id: string, fn: (doc: FieldworkDoc) => FieldworkDoc) =>
      writeFieldwork(id, (doc) => {
        if (!doc) throw new Error(`No fieldwork for study ${id}`)
        return fn(doc)
      }),
    [writeFieldwork],
  )
  const devSetModerator = useCallback((mode: 'ai' | 'human') => {
    setState((prev) => {
      const guide = prev.guides[MOISTURIZER_ID]
      if (!guide) return prev
      const next: GuideDoc = {
        ...guide,
        moderator: { ...withTeam({ ...guide.moderator, mode, agentId: mode === 'ai' ? 'ava' : null, style: mode === 'ai' ? 'warm' : null }, mode === 'human' ? acceptedRoster(['u-jordan', 'u-priya'], studyLanguage(prev.briefs[MOISTURIZER_ID]) ?? '') : []), standby: mode === 'ai' ? acceptedRoster(['u-priya', 'u-jordan'], studyLanguage(prev.briefs[MOISTURIZER_ID]) ?? '') : undefined },
      }
      const plan = compileStudyPlan(next, studyLanguage(prev.briefs[MOISTURIZER_ID]))
      const old = prev.fieldworks[MOISTURIZER_ID]
      const audience = prev.audiences[MOISTURIZER_ID]
      const fieldwork = old && audience && plan.state === 'ok' ? { ...generateFieldwork({ studyId: MOISTURIZER_ID, audience, guide: next, plan: plan.plan, releaseNumber: old.releaseNumber, releaseVersion: old.releaseVersion, launch: prev.launches[MOISTURIZER_ID] }), paused: old.paused, log: old.log } : old
      return {
        ...prev,
        guides: { ...prev.guides, [MOISTURIZER_ID]: next },
        fieldworks: fieldwork ? { ...prev.fieldworks, [MOISTURIZER_ID]: fieldwork } : prev.fieldworks,
        moisturizer: { ...prev.moisturizer, moderatorType: mode === 'ai' ? 'AI-led' : 'Human-led' },
      }
    })
  }, [])
  const updateLaunch = useCallback(
    (id: string, fn: (doc: LaunchDoc) => LaunchDoc) => writeLaunch(id, (doc) => fn(doc ?? emptyLaunchDoc(id))),
    [writeLaunch],
  )

  const setBrief = useCallback((id: string, doc: BriefDoc) => writeBrief(id, () => doc), [writeBrief])
  const updateBrief = useCallback(
    (id: string, fn: (doc: BriefDoc) => BriefDoc) =>
      writeBrief(id, (doc) => {
        if (!doc) throw new Error(`No brief for study ${id}`)
        return fn(doc)
      }),
    [writeBrief],
  )

  // Who counts as a moderator is read from the company team list, so a person accepting re-derives every study.
  const team = useTeamModerators()

  const value = useMemo<StudyContextValue>(() => {
    // Not Ready and Ready to Launch are worked out from the launch checks; Live, Paused and the rest are stored.
    const derive = (s: StudyRecord): StudyRecord => {
      if (s.status !== 'Not Ready' && s.status !== 'Ready to Launch') return s
      const r = readiness({ study: s, audience: state.audiences[s.id], guide: state.guides[s.id], launch: state.launches[s.id], language: studyLanguage(state.briefs[s.id]) })
      return r.ready === (s.status === 'Ready to Launch') ? s : { ...s, status: r.ready ? 'Ready to Launch' : 'Not Ready' }
    }
    const studies = [...state.created.map(derive), derive(state.moisturizer), derive(state.pet), ...otherStudies]
    const editable = new Set([state.moisturizer.id, state.pet.id, ...state.created.map((s) => s.id)])
    return {
      studies,
      getStudy: (id) => studies.find((s) => s.id === id),
      isEditable: (id) => Boolean(id && editable.has(id)),
      createStudy,
      getBrief: (id) => (id ? state.briefs[id] : undefined),
      getLanguage: (id) => (id ? studyLanguage(state.briefs[id]) : null),
      setBrief,
      updateBrief,
      getAudience: (id) => (id ? state.audiences[id] : undefined),
      setAudience,
      updateAudience,
      getGuide: (id) => (id ? state.guides[id] : undefined),
      setGuide,
      updateGuide,
      getLaunch: (id) => (id ? state.launches[id] : undefined),
      updateLaunch,
      fieldworks: state.fieldworks,
      getFieldwork: (id) => (id ? state.fieldworks[id] : undefined),
      updateFieldwork,
      devSetModerator,
      stage: state.stage,
      setStage,
      resetSeed,
    }
  }, [state, team, createStudy, setBrief, updateBrief, setAudience, updateAudience, setGuide, updateGuide, updateLaunch, updateFieldwork, devSetModerator, setStage, resetSeed])

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudies() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudies must be used inside <StudyProvider>')
  return ctx
}
