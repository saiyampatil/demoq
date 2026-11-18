import { cn } from './cn'

/** An on/off control. The label is read aloud, and the state is shown as text by the caller where it matters. */
export function Switch({ checked, onChange, label, disabled, testid, mixed }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean; testid?: string; /** Half on: some of what it controls is on and some is off. Clicking it turns everything on. */ mixed?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={label}
      data-testid={testid}
      disabled={disabled}
      onClick={() => onChange(mixed ? true : !checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50',
        mixed ? 'border-ink bg-iris-300' : checked ? 'border-ink bg-ink' : 'border-mist-strong bg-haze',
      )}
    >
      <span className={cn('absolute size-3.5 rounded-full bg-white shadow-raised transition-transform', mixed ? 'translate-x-[10px]' : checked ? 'translate-x-[18px]' : 'translate-x-[3px] bg-graphite')} />
    </button>
  )
}
