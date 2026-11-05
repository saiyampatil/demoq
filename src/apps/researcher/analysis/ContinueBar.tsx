import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { AlertIcon, CheckIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { Tooltip } from '@/components/Tooltip'
import { WizardFooter } from '@/components/WizardFooter'
import { screenById, studyPath } from '@/routes/screens'
import type { Readiness } from '@/state/analysisProgress'

/**
 * The way forward from the Codebook. It says in plain words where things stand, and one button moves on.
 * With nothing to warn about it moves straight on; with warnings it asks first. Only having nothing to analyse blocks it.
 */
export function ContinueBar({ studyId, readiness, message, next, previous, stay }: { studyId: string; readiness: Readiness; message: React.ReactNode; next: { screen: 'A2' | 'A3'; label: string }; previous?: { screen: 'A1' | 'A2'; label: string }; stay: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const to = studyPath(studyId, screenById[next.screen])
  const go = () => navigate(to)
  const label = next.label

  return (
    <>
      <WizardFooter message={message} previous={previous ? { to: studyPath(studyId, screenById[previous.screen]), label: previous.label } : undefined}>
        {readiness.blocked ? (
          <Tooltip content={readiness.blocked} focusable>
            <Button variant="primary" disabled data-testid="continue-analysis">
              {label}
            </Button>
          </Tooltip>
        ) : (
          <Button variant="primary" data-testid="continue-analysis" onClick={() => (readiness.warnings.length ? setOpen(true) : go())}>
            {label}
          </Button>
        )}
      </WizardFooter>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Before you continue"
        description="You can keep going and come back at any time. Anything you change here will show up in the next steps."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {stay}
            </Button>
            <Button variant="primary" onClick={go} data-testid="continue-anyway">
              Continue anyway
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-3 gap-2">
          {readiness.facts.map((f) => (
            <div key={f.label} className="rounded-sm border border-mist px-3 py-2">
              <dt className="text-xs text-graphite">{f.label}</dt>
              <dd className={cn('text-lg font-semibold tabular-nums', !f.ok && 'text-pending-fg')}>{f.value}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 flex flex-col gap-2 pb-1" data-testid="readiness-warnings">
          {readiness.warnings.map((w) => (
            <li key={w.key} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0 text-pending-fg">
                <AlertIcon size={15} />
              </span>
              {w.text}
            </li>
          ))}
          {readiness.facts.filter((f) => f.ok).length > 0 && (
            <li className="flex items-start gap-2 text-sm text-graphite">
              <span className="mt-0.5 shrink-0 text-positive-fg">
                <CheckIcon size={15} />
              </span>
              {readiness.facts.filter((f) => f.ok).map((f) => `${f.value} ${f.label.toLowerCase()}`).join(', ')}.
            </li>
          )}
        </ul>
      </Modal>
    </>
  )
}
