// Mock catalogue for Module 3: AI agents, human moderators and the languages an interview can run in.

export type Agent = { id: string; name: string; expertise: string; note: string; why: string }

export const AGENTS: Agent[] = [
  {
    id: 'ava',
    name: 'Ava',
    expertise: 'Skincare and beauty',
    note: 'Trained on 1,200+ skincare interviews: routines, ingredients, claims, texture and packaging.',
    why: 'This study tests facial moisturizer concepts with women who have dry or combination skin, which is Ava’s home territory: she knows the routine language and the claims people push back on.',
  },
  {
    id: 'noor',
    name: 'Noor',
    expertise: 'Personal care and wellness',
    note: 'Everyday self-care routines and how people form and break habits.',
    why: 'Strong on habit change, which fits the “what would make you switch” theme, but less used to judging packaging and claims.',
  },
  {
    id: 'theo',
    name: 'Theo',
    expertise: 'Consumer goods generalist',
    note: 'Broad FMCG interviews, strong on shopping behaviour and brand switching.',
    why: 'Good on switching and price trade-offs. Less depth on skincare vocabulary, so probes may stay general.',
  },
  {
    id: 'mila',
    name: 'Mila',
    expertise: 'Concept and packaging testing',
    note: 'Reactions to concepts, claims and pack design, including stimulus walk-throughs.',
    why: 'Best at stimulus walk-throughs and capturing first reactions, but with less skincare routine background.',
  },
  {
    id: 'zoe',
    name: 'Zoe',
    expertise: 'Gen Z and lifestyle',
    note: 'Younger consumers, social influence and trend-led buying.',
    why: 'Suited to younger, trend-led audiences. This study’s audience is 25–44, so she’s a weaker match.',
  },
]
export const SUGGESTED_AGENT = 'ava'

export type HumanModerator = { id: string; name: string; title: string; note: string }

export const HUMAN_MODERATORS: HumanModerator[] = [
  { id: 'u-jordan', name: 'Jordan Lee', title: 'Freelance moderator, beauty and personal care', note: 'Available weekdays, US Eastern.' },
  { id: 'u-priya', name: 'Priya Shah', title: 'Moderator', note: 'Available weekday evenings, US Eastern.' },
  { id: 'u-sam', name: 'Sam Okafor', title: 'Moderator, beauty and wellness', note: 'Available Tuesday to Saturday, US Pacific.' },
  { id: 'u-elena', name: 'Elena Brooks', title: 'Moderator, concept testing', note: 'Available weekdays, US Central.' },
]

/**
 * Who is available to take a participant who asks for a human, right now. Routing is by standby: the moderator who has been
 * idle longest is offered the session first, one at a time, with 60 seconds to answer. A mock; the moderator app isn't built.
 */
export type ModeratorState = 'Online' | 'In session' | 'Offline'
export const MODERATOR_ROSTER: { id: string; state: ModeratorState; standby: boolean; idleMin: number }[] = [
  { id: 'u-priya', state: 'Online', standby: true, idleMin: 130 },
  { id: 'u-jordan', state: 'Online', standby: true, idleMin: 40 },
  { id: 'u-sam', state: 'In session', standby: false, idleMin: 0 },
  { id: 'u-elena', state: 'Offline', standby: false, idleMin: 0 },
]
/** What a participant is promised when they ask for a human. */
export const ESCALATION_PROMISE_HOURS = 24
export const OFFER_SECONDS = 60

export const LANGUAGES = ['English (US)', 'English (UK)', 'Spanish (US)', 'French (Canada)', 'German', 'Hindi']

export const STYLES = [
  { value: 'warm', label: 'Warm', note: 'Friendly and encouraging. Puts people at ease, good for personal topics.' },
  { value: 'neutral', label: 'Neutral', note: 'Even and unobtrusive. Keeps the moderator out of the answer.' },
  { value: 'probing', label: 'Probing', note: 'Digs into reasons. Asks “why” and “what else” more often.' },
] as const
