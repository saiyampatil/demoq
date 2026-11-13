import type { Stimulus } from '@/state/guide'

const HUES = [210, 340, 150, 35, 270, 190]
const hueOf = (key: string) => HUES[[...key].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length]

/** A generated placeholder for a stimulus: a coloured card with its label. No file is loaded, so it never fails and never leaves the page. */
export function StimulusThumb({ name, kind, className, width }: { name: string; kind?: Stimulus['kind']; className?: string; width?: number }) {
  const h = hueOf(name)
  return (
    <div
      role="img"
      aria-label={`${name}${kind ? `, ${kind}` : ''}`}
      className={`flex aspect-[4/3] w-28 shrink-0 flex-col justify-between rounded-sm border p-2 ${className ?? ''}`}
      style={{ ...(width ? { width } : {}), background: `hsl(${h} 70% 94%)`, borderColor: `hsl(${h} 45% 78%)`, color: `hsl(${h} 55% 25%)` }}
    >
      <span className="text-[10px] font-semibold tracking-wide uppercase">{kind === 'video' ? 'Video' : kind === 'image' ? 'Image' : 'Concept'}</span>
      <span className="text-xs leading-tight font-medium">{name}</span>
    </div>
  )
}
