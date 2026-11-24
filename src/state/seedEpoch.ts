// Runs first, before any store reads its saved state. If the browser's saved Ice Cream state was made from an older seed, it is dropped, so
// no browser keeps showing the old seed. Other studies are not touched. Imports only the version number, never a store.

import { ICE_SEED_VERSION } from '@/mock/seedVersions'

const EPOCH = 'pulseai-qual:seed-epoch'
const ICE = 'ice-cream-flavours'
/** Saved stores that hold one entry per study ID. */
const BY_STUDY = ['pulseai-qual:codebook', 'pulseai-qual:report', 'pulseai-qual:audio-summary', 'pulseai-qual:wordcloud', 'pulseai-qual:showreel']

function readJson(key: string): Record<string, unknown> | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked: nothing to carry over.
  }
}

/** Drops the saved Ice Cream state when it was made from another seed version. Returns whether it did. */
export function applySeedEpoch(): boolean {
  const have = readJson(EPOCH) ?? {}
  if (have[ICE] === ICE_SEED_VERSION) return false
  BY_STUDY.forEach((key) => {
    const store = readJson(key)
    if (store && ICE in store) {
      const { [ICE]: _gone, ...rest } = store
      void _gone
      writeJson(key, rest)
    }
  })
  // The main store re-seeds a study whose record and brief are missing, so removing those makes it start Ice Cream again.
  const main = readJson('pulseai-qual:v2') as { ice?: unknown; briefs?: Record<string, unknown> } | undefined
  if (main) {
    const { [ICE]: _brief, ...briefs } = main.briefs ?? {}
    void _brief
    const { ice: _ice, ...rest } = main
    void _ice
    writeJson('pulseai-qual:v2', { ...rest, briefs })
  }
  // What the Researcher did to each Ice Cream session (P-41xx) belongs to the old roster.
  const review = readJson('pulseai-qual:review-state') as { notes?: Record<string, unknown>; events?: Record<string, unknown> } | undefined
  if (review) {
    const keep = (m?: Record<string, unknown>) => Object.fromEntries(Object.entries(m ?? {}).filter(([id]) => !/^P-41\d\d/.test(id)))
    writeJson('pulseai-qual:review-state', { ...review, notes: keep(review.notes), events: keep(review.events) })
  }
  writeJson(EPOCH, { ...have, [ICE]: ICE_SEED_VERSION })
  return true
}

applySeedEpoch()
