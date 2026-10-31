import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variantClass: Record<Variant, string> = {
  primary: 'bg-iris-600 text-white border-iris-600 hover:bg-iris-700 hover:border-iris-700',
  secondary: 'bg-surface text-ink border-mist-strong hover:bg-haze',
  ghost: 'bg-transparent text-graphite border-transparent hover:bg-haze hover:text-ink',
  danger: 'bg-surface text-negative-fg border-negative-line hover:bg-negative-bg',
}

const sizeClass: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-sm gap-1.5',
  md: 'h-9 px-3.5 text-base gap-2',
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
  /** Renders a router link styled as a button. */
  to?: string
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  to,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center rounded-sm border font-medium whitespace-nowrap transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
    variantClass[variant],
    sizeClass[size],
    className,
  )
  const content = (
    <>
      {loading ? <Spinner /> : icon}
      {children}
    </>
  )

  if (to && !disabled) {
    return (
      <Link to={to} className={classes} data-testid={(rest as Record<string, string | undefined>)['data-testid']}>
        {content}
      </Link>
    )
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {content}
    </button>
  )
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="animate-spin" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
