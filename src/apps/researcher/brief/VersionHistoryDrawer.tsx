import { useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { DiffText } from '@/components/DiffText'
import { ChevronLeftIcon } from '@/components/icons'
import { SideDrawer } from '@/components/SideDrawer'
import { StatusChip } from '@/components/StatusChip'
import { formatDateTime } from '@/lib/format'
import { approvedVersions, changedSections, SECTION_KEYS, sectionTitle, snapAll, type BriefDoc } from '@/state/brief'

export function VersionHistoryDrawer({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: BriefDoc }) {
  const [selected, setSelected] = useState<number | null>(null)
  const approved = approvedVersions(doc)
  const latest = doc.versions.at(-1)?.number
  const version = doc.versions.find((v) => v.number === selected)
  const current = doc.draft ? snapAll(doc.draft) : undefined

  return (
    <SideDrawer
      open={open}
      onClose={() => {
        setSelected(null)
        onClose()
      }}
      title={version ? `Version ${version.number} compared with current` : 'Version history'}
      description={version ? 'Current means what’s in the editor now, including unsaved changes.' : 'Every saved version. Pick one to see what changed since.'}
    >
      {version && current ? (
        <div className="flex flex-col gap-4">
          <Button size="sm" variant="ghost" icon={<ChevronLeftIcon />} onClick={() => setSelected(null)} className="self-start">
            All versions
          </Button>
          {(() => {
            const changed = changedSections(version.sections, current)
            return (
              <>
                <p className="text-sm text-graphite">
                  {changed.length === 0 ? 'No differences.' : `${changed.length} of 7 sections changed: ${changed.map(sectionTitle).join(', ')}.`}
                </p>
                {SECTION_KEYS.map((k) => {
                  const isChanged = changed.includes(k)
                  return (
                    <section key={k} className={cn('rounded-md border p-3', isChanged ? 'border-mist-strong bg-surface' : 'border-mist bg-paper')}>
                      <h3 className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                        {sectionTitle(k)}
                        <span className="text-xs font-normal text-graphite">{isChanged ? 'Changed' : 'No changes'}</span>
                      </h3>
                      {isChanged && (
                        <div className="mt-1.5 text-sm">
                          <DiffText before={version.sections[k].text} after={current[k].text} />
                          {version.sections[k].source !== current[k].source && (
                            <p className="mt-1 text-xs text-graphite">
                              Source: {version.sections[k].source} → {current[k].source}
                            </p>
                          )}
                          {Boolean(version.sections[k].aiAccepted) !== Boolean(current[k].aiAccepted) && (
                            <p className="mt-1 text-xs text-graphite">AI content accepted since this version</p>
                          )}
                        </div>
                      )}
                    </section>
                  )
                })}
              </>
            )
          })()}
        </div>
      ) : (
        <ol className="flex flex-col">
          {[...doc.versions].reverse().map((v) => (
            <li key={v.number} className="border-b border-mist py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Version {v.number}</span>
                {approved.has(v.number) && <StatusChip status="Approved" size="sm" />}
                {v.number === latest && <span className="text-xs text-graphite">Latest</span>}
              </div>
              <p className="mt-0.5 text-sm">{v.note}</p>
              <p className="text-xs text-graphite">
                {v.savedBy}, <span className="tabular-nums">{formatDateTime(v.savedAt)}</span>
              </p>
              <Button size="sm" className="mt-2" onClick={() => setSelected(v.number)}>
                Compare with current
              </Button>
            </li>
          ))}
        </ol>
      )}
    </SideDrawer>
  )
}
