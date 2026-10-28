import { diffWords } from '@/lib/diff'

// Shows what changed between two versions of a text: removed words struck through, added words underlined.
export function DiffText({ before, after }: { before: string; after: string }) {
  if (!before && !after) return <p className="text-sm text-muted">Empty in both.</p>
  const parts = diffWords(before, after)
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.type === 'same' ? (
          <span key={i}>{p.text}</span>
        ) : p.type === 'del' ? (
          <del key={i} className="rounded-xs bg-negative-bg text-negative-fg decoration-negative-fg">
            <span className="sr-only">Removed: </span>
            {p.text}
          </del>
        ) : (
          <ins key={i} className="rounded-xs bg-positive-bg text-positive-fg no-underline">
            <span className="sr-only">Added: </span>
            {p.text}
          </ins>
        ),
      )}
    </p>
  )
}
