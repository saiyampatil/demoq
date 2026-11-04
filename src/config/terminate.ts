// What happens to sessions still running when a study is terminated. One constant, so the rule is changed in one place.

import type { SessionStatus } from '@/state/fieldwork'

/** Sessions in progress end here. They aren't resumable: terminating also stops every link. Pending a product decision. */
export const TERMINATE_IN_PROGRESS_AS: SessionStatus = 'Incomplete (resumable)'
