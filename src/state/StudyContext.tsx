import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_STAGE, MOISTURIZER_ID, presetStudy, type StagePresetKey } from '@/mock/moisturizerStudy'
import { otherStudies } from '@/mock/studies'
import type { StudyRecord } from '@/mock/types'

const STORAGE_KEY = 'pulseai-qual:v1'

type Persisted = { stage: StagePresetKey; moisturizer: StudyRecord }

type StudyContextValue = {
  studies: StudyRecord[]
  getStudy: (id: string | undefined) => StudyRecord | undefined
  stage: StagePresetKey
  setStage: (stage: StagePresetKey) => void
  resetSeed: () => void
  updateMoisturizer: (fn: (s: StudyRecord) => StudyRecord) => void
}

const StudyContext = createContext<StudyContextValue | null>(null)

function freshState(stage: StagePresetKey = DEFAULT_STAGE): Persisted {
  return { stage, moisturizer: presetStudy(stage) }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted
      if (parsed?.moisturizer?.id === MOISTURIZER_ID) return parsed
    }
  } catch {
    // Storage blocked or corrupt: fall back to the seed.
  }
  return freshState()
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

  const setStage = useCallback((stage: StagePresetKey) => setState(freshState(stage)), [])
  const resetSeed = useCallback(() => setState(freshState()), [])
  const updateMoisturizer = useCallback(
    (fn: (s: StudyRecord) => StudyRecord) => setState((prev) => ({ ...prev, moisturizer: fn(prev.moisturizer) })),
    [],
  )

  const value = useMemo<StudyContextValue>(() => {
    const studies = [state.moisturizer, ...otherStudies]
    return {
      studies,
      getStudy: (id) => studies.find((s) => s.id === id),
      stage: state.stage,
      setStage,
      resetSeed,
      updateMoisturizer,
    }
  }, [state, setStage, resetSeed, updateMoisturizer])

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudies() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudies must be used inside <StudyProvider>')
  return ctx
}
