import type { Person } from './types'

export const people = {
  researcher: {
    id: 'u-maya',
    name: 'Maya Ortiz',
    role: 'Researcher',
    title: 'Senior Qualitative Researcher',
    organization: 'PulseAI Research',
    email: 'maya.ortiz@pulseai.example',
  },
  client: {
    id: 'u-erin',
    name: 'Erin Walsh',
    role: 'End Client',
    title: 'Consumer Insights Lead',
    organization: 'Verdane Skincare',
    email: 'erin.walsh@verdane.example',
  },
  moderatorJordan: {
    id: 'u-jordan',
    name: 'Jordan Lee',
    role: 'Human moderator',
    title: 'Freelance Moderator, Beauty & Personal Care',
    organization: 'PulseAI Research',
    email: 'jordan.lee@pulseai.example',
  },
  moderatorPriya: {
    id: 'u-priya',
    name: 'Priya Shah',
    role: 'Human moderator',
    title: 'Moderator',
    organization: 'PulseAI Research',
    email: 'priya.shah@pulseai.example',
  },
} satisfies Record<string, Person>

export const currentUser = people.researcher
