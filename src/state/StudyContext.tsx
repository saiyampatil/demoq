import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { seedApprovedBrief } from '@/mock/brief'
import { DEFAULT_STAGE, MOISTURIZER_ID, presetStudy, type StagePresetKey } from '@/mock/moisturizerStudy'
import { otherStudies } from '@/mock/studies'
import type { StudyRecord } from '@/mock/types'
import { briefSummary, now, type BriefDoc } from './brief'

const STORAGE_KEY = 'pulseai-qual:v2'

type Persisted = {
  stage: StagePresetKey
  moisturizer: StudyRecord
  /** Studies created with "New study", newest first. */
  created: StudyRecord[]
  briefs: Record<string, BriefDoc>
}

type StudyContextValue = {
  studies: StudyRecord[]
  getStudy: (id: string | undefined) => StudyRecord | undefined
  /** Only the seed study and created studies can be edited; the other dashboard studies are read-only. */
  isEditable: (id: string | undefined) => boolean
  createStudy: (name: string) => StudyRecord
  getBrief: (id: string | undefined) => BriefDoc | undefined
  setBrief: (id: string, doc: BriefDoc) => void
  updateBrief: (id: string, fn: (doc: BriefDoc) => BriefDoc) => void
  stage: StagePresetKey
  setStage: (stage: StagePresetKey) => void
  resetSeed: () => void
}

const StudyContext = createContext<StudyContextValue | null>(null)

function seedStage(stage: StagePresetKey): Pick<Persisted, 'stage' | 'moisturizer' | 'briefs'> {
  const moisturizer = presetStudy(stage)
  if (stage === 'new') return { stage, moisturizer, briefs: {} }
  const brief = seedApprovedBrief(MOISTURIZER_ID)
  return { stage, moisturizer: { ...moisturizer, brief: briefSummary(brief) }, briefs: { [MOISTURIZER_ID]: brief } }
}

const freshState = (): Persisted => ({ ...seedStage(DEFAULT_STAGE), created: [] })

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted
      if (parsed?.moisturizer?.id === MOISTURIZER_ID && Array.isArray(parsed.created)) return parsed
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

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Progress just won't survive a refresh.
    }
  }, [state])

  const setStage = useCallback(
    (stage: StagePresetKey) =>
      setState((prev) => {
        // Changing stage replaces only the seed study; created studies stay.
        const { [MOISTURIZER_ID]: _seed, ...others } = prev.briefs
        void _seed
        const next = seedStage(stage)
        return { ...prev, ...next, briefs: { ...others, ...next.briefs } }
      }),
    [],
  )
  const resetSeed = useCallback(() => setState(freshState()), [])

  const createStudy = useCallback((name: string) => {
    const study: StudyRecord = {
      id: slugify(name),
      name: name.trim(),
      client: 'Client not set',
      category: 'Not set',
      moderatorType: 'AI-led',
      interviewLanguage: 'Not set',
      targetCompletes: 0,
      completedSessions: 0,
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
      return { ...prev, briefs: { ...prev.briefs, [id]: doc }, moisturizer: sync(prev.moisturizer), created: prev.created.map(sync) }
    })
  }, [])

  const setBrief = useCallback((id: string, doc: BriefDoc) => writeBrief(id, () => doc), [writeBrief])
  const updateBrief = useCallback(
    (id: string, fn: (doc: BriefDoc) => BriefDoc) =>
      writeBrief(id, (doc) => {
        if (!doc) throw new Error(`No brief for study ${id}`)
        return fn(doc)
      }),
    [writeBrief],
  )

  const value = useMemo<StudyContextValue>(() => {
    const studies = [...state.created, state.moisturizer, ...otherStudies]
    const editable = new Set([state.moisturizer.id, ...state.created.map((s) => s.id)])
    return {
      studies,
      getStudy: (id) => studies.find((s) => s.id === id),
      isEditable: (id) => Boolean(id && editable.has(id)),
      createStudy,
      getBrief: (id) => (id ? state.briefs[id] : undefined),
      setBrief,
      updateBrief,
      stage: state.stage,
      setStage,
      resetSeed,
    }
  }, [state, createStudy, setBrief, updateBrief, setStage, resetSeed])

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudies() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudies must be used inside <StudyProvider>')
  return ctx
}
