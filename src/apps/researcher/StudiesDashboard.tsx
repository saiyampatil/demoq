import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { cn } from '@/components/cn'
import { PlusIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Table, type Column } from '@/components/Table'
import { formatDate } from '@/lib/format'
import type { StudyRecord } from '@/mock/types'
import { screenById, steps, studyPath } from '@/routes/screens'
import { useStudies } from '@/state/StudyContext'
import { landingStep } from '@/state/workflow'
import { ScreenTag } from '../shared/ScreenTag'

type Filter = 'all' | 'setup' | 'fieldwork' | 'closed'

const filters: { key: Filter; label: string; empty: string; match: (s: StudyRecord) => boolean }[] = [
  { key: 'all', label: 'All', empty: 'No studies yet', match: () => true },
  { key: 'setup', label: 'In setup', empty: 'No studies in setup', match: (s) => s.status === 'Not Ready' || s.status === 'Ready to Launch' },
  { key: 'fieldwork', label: 'In fieldwork', empty: 'No studies in fieldwork', match: (s) => s.status === 'Live' || s.status === 'Paused' },
  { key: 'closed', label: 'Closed', empty: 'No closed studies', match: (s) => s.status === 'Complete' || s.status === 'Terminated' },
]

const columns: Column<StudyRecord>[] = [
  {
    key: 'study',
    header: 'Study',
    cell: (s) => (
      <div className="min-w-56">
        <div className="font-medium text-ink">{s.name}</div>
        <div className={s.client === 'Client not set' ? 'text-sm text-muted' : 'text-sm text-graphite'}>{s.client}</div>
      </div>
    ),
  },
  { key: 'moderator', header: 'Moderator', cell: (s) => <span className="whitespace-nowrap text-graphite">{s.moderatorType}</span> },
  {
    key: 'step',
    header: 'Current step',
    cell: (s) => <span className="whitespace-nowrap">{steps.find((x) => x.key === landingStep(s))?.label}</span>,
  },
  { key: 'status', header: 'Status', cell: (s) => <StatusChip status={s.status} /> },
  {
    key: 'interviews',
    header: 'Interviews',
    align: 'right',
    cell: (s) =>
      s.targetCompletes ? (
        <span className="whitespace-nowrap tabular-nums">
          {s.completedSessions} <span className="text-graphite">of {s.targetCompletes}</span>
        </span>
      ) : (
        <span className="text-muted">Not set</span>
      ),
  },
  {
    key: 'updated',
    header: 'Last updated',
    align: 'right',
    cell: (s) => <span className="whitespace-nowrap text-graphite tabular-nums">{formatDate(s.updatedAt)}</span>,
  },
]

export function StudiesDashboard() {
  const { studies } = useStudies()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Simulated fetch so the loading state is visible. ?state=error previews the error state.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450)
    return () => clearTimeout(t)
  }, [])

  const failed = params.get('state') === 'error'
  const active = filters.find((f) => f.key === filter)!
  const rows = useMemo(() => studies.filter(active.match), [studies, active])

  return (
    <main className="mx-auto w-full max-w-content px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-3">
          <ScreenTag id="R0" />
          <h1 className="text-xl font-semibold">Studies</h1>
        </div>
        <div className="ml-auto">
          <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreating(true)}>
            New study
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label="Filter studies" className="mb-3 flex flex-wrap gap-1">
        {filters.map((f) => {
          const count = studies.filter(f.match).length
          const selected = f.key === filter
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-sm px-3 text-sm font-medium',
                selected ? 'bg-surface text-ink ring-1 ring-mist shadow-raised' : 'text-graphite hover:bg-haze hover:text-ink',
              )}
            >
              {f.label}
              <span className="text-xs text-muted tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      <Card flush>
        {failed ? (
          <ErrorState
            title="Studies didn’t load"
            description="The study list couldn’t be reached. Check your connection, then try again."
            onRetry={() => setParams({})}
          />
        ) : loading ? (
          <LoadingState label="Loading studies" rows={4} />
        ) : (
          <Table
            caption="Studies"
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            onRowClick={(s) => navigate(`/researcher/studies/${s.id}`)}
            empty={
              <EmptyState
                title={active.empty}
                description="Studies move here as their status changes."
                action={
                  <Button size="sm" onClick={() => setFilter('all')}>
                    Show all studies
                  </Button>
                }
              />
            }
          />
        )}
      </Card>

      <NewStudyModal open={creating} onClose={() => setCreating(false)} />
    </main>
  )
}

function NewStudyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createStudy } = useStudies()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()

  const close = () => {
    setName('')
    setError(undefined)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New study"
      description="Name the study. You’ll add the client’s brief next."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-study-form">
            Create study
          </Button>
        </>
      }
    >
      <form
        id="new-study-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) {
            setError('Enter a study name.')
            return
          }
          const study = createStudy(name)
          close()
          navigate(studyPath(study.id, screenById.R1))
        }}
      >
        <TextField
          label="Study name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(undefined)
          }}
          placeholder="e.g. Sunscreen Texture Study"
          error={error}
          maxLength={80}
        />
      </form>
    </Modal>
  )
}
