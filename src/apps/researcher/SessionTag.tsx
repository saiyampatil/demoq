import { cn } from '@/components/cn'

/**
 * The participant ID is the main label everywhere. A participant who has had more than one session (a resume,
 * a retry, a reschedule) also shows which one this is: "P-2044 · Session 2 of 2".
 */
export function SessionTag({ participantId, no, count, className }: { participantId: string; no: number; count: number; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>
      {participantId}
      {count > 1 && (
        <>
          {' '}
          <span className="ml-0.5 text-xs font-normal text-graphite">Session {no} of {count}</span>
        </>
      )}
    </span>
  )
}

/** The same label as plain text, for aria-labels and downloads. */
export const sessionText = (participantId: string, no: number, count: number) => (count > 1 ? `${participantId}, session ${no} of ${count}` : participantId)
