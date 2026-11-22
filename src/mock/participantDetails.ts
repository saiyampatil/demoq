// The details shown beside a statement in the word cloud: segment, age band and city. The prototype's sessions know a state and a
// group, nothing more, so the age band and the city are made up from the participant ID: the same person always gets the same ones.
import { STUDY_SEEDS } from './sessions'
import { segmentWord } from './studyAnalysis'

export type Details = { segment: string; ageBand: string; city: string }

const AGE_BANDS = ['25 to 34', '35 to 44', '45 to 54', '55 to 64']
/** Ice Cream's audience is 22 to 45, so its bands stay inside it. */
const ICE_AGE_BANDS = ['22 to 29', '30 to 37', '38 to 45']
const CITY_OF_STATE: Record<string, string> = {
  'New York': 'Brooklyn', Texas: 'Austin', California: 'Sacramento', Georgia: 'Atlanta', Illinois: 'Chicago', Washington: 'Seattle', Massachusetts: 'Boston', Florida: 'Tampa', Ohio: 'Columbus', Colorado: 'Denver',
}
const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 11)

export function detailsOf(participantId: string): Details {
  const state = Object.values(STUDY_SEEDS).flat().find((s) => s.participant === participantId)?.state
  return {
    segment: segmentWord(participantId).replace(/^./, (c) => c.toUpperCase()),
    ageBand: (STUDY_SEEDS['ice-cream-flavours'].some((x) => x.participant === participantId) ? ICE_AGE_BANDS : AGE_BANDS)[hash(participantId) % (STUDY_SEEDS['ice-cream-flavours'].some((x) => x.participant === participantId) ? ICE_AGE_BANDS : AGE_BANDS).length],
    city: (state && CITY_OF_STATE[state]) || ['Portland', 'Nashville', 'Phoenix', 'Minneapolis'][hash(participantId + 'c') % 4],
  }
}
