// The one quiet line under "How people sounded": what the readings are measured on. The words are the same as A2's coverage line
// ("Speech read for 20 of 20 · 5 audio-only, read on speech"), so the two screens never describe the same people differently.
import type { Coverage } from './signals'

export function speechCoverageLine(cov: Coverage): string {
  return `Speech read for ${cov.sessions} of ${cov.sessions}${cov.audioOnly > 0 ? ` · ${cov.audioOnly} audio-only, read on speech` : ''}${cov.excluded > 0 ? ` · ${cov.excluded} excluded in Review are left out` : ''}`
}
