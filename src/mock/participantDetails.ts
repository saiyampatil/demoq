// The details shown beside a statement in the word cloud: segment, age band and city. The prototype's sessions know a state and a
// pet, nothing more, so the age band and the city are made up from the participant ID: the same person always gets the same ones.
import { petOf } from './codebook'
import { PET_SEED_SESSIONS } from './sessions'

export type Details = { segment: string; ageBand: string; city: string }

const AGE_BANDS = ['25 to 34', '35 to 44', '45 to 54', '55 to 64']
const CITY_OF_STATE: Record<string, string> = {
  'New York': 'Brooklyn', Texas: 'Austin', California: 'Sacramento', Georgia: 'Atlanta', Illinois: 'Chicago', Washington: 'Seattle', Massachusetts: 'Boston', Florida: 'Tampa', Ohio: 'Columbus', Colorado: 'Denver',
}
const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 11)

export function detailsOf(participantId: string): Details {
  const state = PET_SEED_SESSIONS.find((s) => s.participant === participantId)?.state
  return {
    segment: `${petOf(participantId)} owner`,
    ageBand: AGE_BANDS[hash(participantId) % AGE_BANDS.length],
    city: (state && CITY_OF_STATE[state]) || ['Portland', 'Nashville', 'Phoenix', 'Minneapolis'][hash(participantId + 'c') % 4],
  }
}
