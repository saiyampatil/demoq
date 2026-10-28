import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

const control =
  'w-full rounded-sm border border-mist-strong bg-surface px-3 text-base text-ink placeholder:text-muted hover:border-graphite focus:border-iris-600 disabled:bg-haze disabled:text-graphite'

type FieldShellProps = { id: string; label?: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string }

function FieldShell({ id, label, hint, error, children, className }: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-negative-fg">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-graphite">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: string; containerClassName?: string }

export function TextField({ label, hint, error, containerClassName, className, id, ...rest }: TextFieldProps) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={containerClassName}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(control, 'h-9', error && 'border-negative-fg', className)}
        {...rest}
      />
    </FieldShell>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; error?: string; containerClassName?: string }

export function TextArea({ label, hint, error, containerClassName, className, id, rows = 3, ...rest }: TextAreaProps) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={containerClassName}>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(control, 'resize-y py-2 leading-[21px]', error && 'border-negative-fg', className)}
        {...rest}
      />
    </FieldShell>
  )
}
