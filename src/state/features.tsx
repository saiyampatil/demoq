import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Recommended additions that aren't PRD requirements. Each sits behind its own flag
// so it can be switched off in the Screen jump menu, or removed by deleting its component.
export const featureDefaults = {
  readinessPanel: true,
  assumptionLedger: true,
  aiDraftDiff: true,
  proofRequired: true,
}

export type FeatureKey = keyof typeof featureDefaults

export const featureInfo: Record<FeatureKey, { label: string; description: string }> = {
  readinessPanel: { label: 'Readiness panel', description: 'R4: explains each blocker and what every section feeds.' },
  assumptionLedger: { label: 'Assumption ledger', description: 'R4 and R5: every skipped item and accepted assumption in one list.' },
  aiDraftDiff: { label: 'AI draft vs your edit', description: 'R4: compare an AI section with the original AI text.' },
  proofRequired: { label: 'Study requires proof of purchase', description: 'Mock study setting. R10 shows a proof thumbnail, or “No proof required for this study” when off.' },
}

const STORAGE_KEY = 'pulseai-qual:features'

type FeaturesValue = { flags: Record<FeatureKey, boolean>; setFlag: (key: FeatureKey, on: boolean) => void }

const FeaturesContext = createContext<FeaturesValue | null>(null)

function load(): Record<FeatureKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...featureDefaults, ...(JSON.parse(raw) as Partial<Record<FeatureKey, boolean>>) }
  } catch {
    // Fall back to defaults.
  }
  return { ...featureDefaults }
}

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState(load)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flags))
    } catch {
      // Flags reset on refresh.
    }
  }, [flags])
  const setFlag = useCallback((key: FeatureKey, on: boolean) => setFlags((f) => ({ ...f, [key]: on })), [])
  const value = useMemo(() => ({ flags, setFlag }), [flags, setFlag])
  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>
}

export function useFeatures() {
  const ctx = useContext(FeaturesContext)
  if (!ctx) throw new Error('useFeatures must be used inside <FeaturesProvider>')
  return ctx
}

export const useFeature = (key: FeatureKey) => useFeatures().flags[key]
