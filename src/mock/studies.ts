import type { StudyRecord } from './types'

// Other studies on the R0 dashboard. Read-only; only the Moisturizer study changes with the stage picker.
export const otherStudies: StudyRecord[] = [
  {
    id: 'oat-barista',
    name: 'Oat Milk Barista Line: Café Usage',
    client: 'Northfield Dairy Co.',
    category: 'Beverages: plant-based milk',
    moderatorType: 'Human-led',
    interviewLanguage: 'English (US)',
    targetCompletes: 16,
    completedSessions: 9,
    updatedAt: '2026-10-28T08:15:00-04:00',
    status: 'Live',
    releaseVersion: 'Release v2.0',
    brief: { status: 'Approved', version: 2, approval: { by: 'Maya Ortiz', at: '2026-09-22T10:00:00-04:00', version: 2 } },
    audience: { status: 'Confirmed', version: 1, approval: { by: 'Maya Ortiz', at: '2026-09-25T10:00:00-04:00', version: 1 } },
    guide: { status: 'Approved', version: 4, approval: { by: 'Maya Ortiz', at: '2026-10-10T10:00:00-04:00', version: 4 } },
  },
  {
    id: 'ev-first-buyers',
    name: 'First-Time EV Buyer Journeys',
    client: 'Cardinal Motors',
    category: 'Automotive: electric vehicles',
    moderatorType: 'AI-led',
    interviewLanguage: 'English (US), Spanish (US)',
    targetCompletes: 24,
    completedSessions: 0,
    updatedAt: '2026-10-26T17:30:00-04:00',
    status: 'Not Ready',
    brief: { status: 'In Review', version: 2 },
    audience: { status: null, version: 0 },
    guide: { status: null, version: 0 },
  },
]
