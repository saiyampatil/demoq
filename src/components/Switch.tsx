import { cn } from './cn'

/** An on/off control. The label is read aloud, and the state is shown as text by the caller where it matters. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50',
        checked ? 'border-ink bg-ink' : 'border-mist-strong bg-haze',
      )}
    >
      <span className={cn('absolute size-3.5 rounded-full bg-white shadow-raised transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-[3px] bg-graphite')} />
    </button>
  )
}
