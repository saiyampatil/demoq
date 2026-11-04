import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </Icon>
)

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m3.5 8.5 3 3 6-7" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </Icon>
)

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3.5 5.5 8l4.5 4.5" />
  </Icon>
)

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3 3" />
  </Icon>
)

export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 1.75v1.5M8 12.75v1.5M14.25 8h-1.5M3.25 8h-1.5M12.4 3.6l-1.06 1.06M4.66 11.34 3.6 12.4M12.4 12.4l-1.06-1.06M4.66 4.66 3.6 3.6" />
  </Icon>
)

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
)

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.5 14 13H2L8 2.5Z" />
    <path d="M8 6.5v3M8 11.25v.01" />
  </Icon>
)

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.5c.4 2.6 1.9 4.1 4.5 4.5-2.6.4-4.1 1.9-4.5 4.5-.4-2.6-1.9-4.1-4.5-4.5 2.6-.4 4.1-1.9 4.5-4.5Z" />
    <path d="M12.5 11v2.5M11.25 12.25h2.5" />
  </Icon>
)

export const LayersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m8 2.5 5.5 3L8 8.5l-5.5-3L8 2.5Z" />
    <path d="m2.5 8.5 5.5 3 5.5-3M2.5 11 8 14l5.5-3" />
  </Icon>
)

export const PulseMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="7" fill="var(--color-iris-600)" />
    <path
      d="M6 17h5l2.5-6 4 11 2.5-5H26"
      fill="none"
      stroke="#fff"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5.75" y="1.75" width="4.5" height="8" rx="2.25" />
    <path d="M3.25 7.5a4.75 4.75 0 0 0 9.5 0M8 12.25v2" />
  </Icon>
)

export const SurveyIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4v12M8 4v12M12 4v12" />
    <path d="M2 7h12M2 12h12" />
    <circle cx="4.5" cy="5.5" r="1" fill="currentColor" />
    <circle cx="4.5" cy="10.5" r="1" fill="currentColor" />
    <circle cx="11.5" cy="5.5" r="1" fill="currentColor" />
    <circle cx="11.5" cy="10.5" r="1" fill="currentColor" />
  </Icon>
)

export const PaperclipIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m13.25 7.5-5.4 5.4a3.25 3.25 0 0 1-4.6-4.6l5.6-5.6a2.1 2.1 0 0 1 3 3L6.3 11.2a1 1 0 0 1-1.4-1.4l5-5" />
  </Icon>
)

export const FileIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.25 1.75H4.5a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5L9.25 1.75Z" />
    <path d="M9.25 1.75V5h3.25" />
  </Icon>
)

export const ArrowUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 13V3M3.75 7.25 8 3l4.25 4.25" />
  </Icon>
)

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 3.25v9.5L12.5 8 5 3.25Z" />
  </Icon>
)

export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="8" height="8" rx="1.5" />
  </Icon>
)

export const HistoryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 8a5.75 5.75 0 1 0 1.7-4.1M2.25 2.5v2.75H5" />
    <path d="M8 5v3.25l2 1.25" />
  </Icon>
)

export const PrinterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 5.75V2h7v3.75M4.5 11.5h-2V6.25h11v5.25h-2" />
    <rect x="4.5" y="9.5" width="7" height="4.5" rx="0.5" />
  </Icon>
)
