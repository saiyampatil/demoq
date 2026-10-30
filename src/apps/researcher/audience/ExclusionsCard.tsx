import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase, controlClass } from '@/components/Field'
import { AlertIcon, CloseIcon, PlusIcon } from '@/components/icons'
import { uid } from '@/state/brief'
import { STANDARD_EXCLUSIONS, type Exclusion, type Screener, type ScreenerQuestion } from '@/state/audience'
import { OriginTag } from './OriginTag'

const input = cn(controlClass, 'h-8 text-sm')

type ExclusionsCardProps = {
  exclusions: Exclusion[]
  screener: Screener | null
  onChange: (fn: (list: Exclusion[]) => Exclusion[]) => void
}

export function ExclusionsCard({ exclusions, screener, onChange }: ExclusionsCardProps) {
  const [adding, setAdding] = useState(false)
  const missingStandard = STANDARD_EXCLUSIONS.filter((s) => !exclusions.some((e) => e.kind === s.kind))
  // Numbered by their place in the screener, so Q5 here is Q5 in the screener editor.
  const choiceQuestions = (screener?.questions ?? []).map((q, i) => ({ ...q, n: i + 1 })).filter((q) => q.type === 'single' || q.type === 'multi')

  return (
    <Card
      title="Exclusions"
      description="People who match an exclusion are screened out and never take a slot."
      actions={
        <>
          <Button
            size="sm"
            icon={<PlusIcon />}
            disabled={missingStandard.length === 0}
            onClick={() => onChange((list) => [...list, ...missingStandard.map((s) => ({ id: uid('ex'), ...s }))])}
          >
            Add standard exclusions
          </Button>
          <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={() => setAdding(true)} disabled={adding}>
            Add custom exclusion
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {exclusions.length === 0 && (
          <p className="flex items-center gap-2 rounded-sm border border-pending-line bg-pending-bg px-3 py-2 text-sm text-pending-fg">
            <AlertIcon size={14} />
            Missing: no exclusions yet. The brief doesn’t set any, so add the standard ones or your own.
          </p>
        )}
        {exclusions.length > 0 && (
          <ul className="flex flex-col gap-2">
            {exclusions.map((e) => (
              <ExclusionRow
                key={e.id}
                exclusion={e}
                onRename={(label) => onChange((list) => list.map((x) => (x.id === e.id ? { ...x, label } : x)))}
                onRemove={() => onChange((list) => list.filter((x) => x.id !== e.id))}
              />
            ))}
          </ul>
        )}
        {adding &&
          (choiceQuestions.length === 0 ? (
            <div className="rounded-sm border border-dashed border-mist-strong p-3 text-sm">
              <p>Custom exclusions must point at one of the screener’s questions, and there’s no screener yet. Generate it in the screener editor first.</p>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAdding(false)}>
                Close
              </Button>
            </div>
          ) : (
            <CustomExclusionForm
              questions={choiceQuestions}
              onCancel={() => setAdding(false)}
              onAdd={(ex) => {
                onChange((list) => [...list, ex])
                setAdding(false)
              }}
            />
          ))}
      </div>
    </Card>
  )
}

function ExclusionRow({ exclusion: e, onRename, onRemove }: { exclusion: Exclusion; onRename: (label: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(e.label)
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-sm border border-mist px-3 py-2">
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (value.trim()) onRename(value.trim())
            setEditing(false)
          }}
        >
          <input aria-label="Exclusion" value={value} onChange={(ev) => setValue(ev.target.value)} className={cn(input, 'flex-1')} autoFocus />
          <Button size="sm" type="submit" variant="primary">
            Done
          </Button>
        </form>
      ) : (
        <span className="min-w-0 flex-1 text-sm">{e.label}</span>
      )}
      <OriginTag origin="added" />
      {!editing && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue(e.label)
            setEditing(true)
          }}
        >
          Edit
        </Button>
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove exclusion: ${e.label}`} className="rounded-sm p-1.5 text-graphite hover:bg-haze hover:text-ink">
        <CloseIcon size={14} />
      </button>
    </li>
  )
}

function CustomExclusionForm({
  questions,
  onAdd,
  onCancel,
}: {
  questions: (ScreenerQuestion & { n: number })[]
  onAdd: (e: Exclusion) => void
  onCancel: () => void
}) {
  const [questionId, setQuestionId] = useState(questions[0].id)
  const q = questions.find((x) => x.id === questionId) ?? questions[0]
  const [answer, setAnswer] = useState('')
  return (
    <form
      className="flex flex-col gap-3 rounded-sm border border-mist-strong p-3"
      onSubmit={(ev) => {
        ev.preventDefault()
        if (!answer) return
        onAdd({ id: uid('ex'), kind: 'custom', label: `Answers “${answer}” to “${q.text}”`, questionId: q.id, answer })
      }}
    >
      <p className="text-sm font-medium">Exclude anyone who…</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Screener question"
          value={questionId}
          onChange={(e) => {
            setQuestionId(e.target.value)
            setAnswer('')
          }}
          className={cn(controlBase, 'h-8 max-w-full min-w-56 flex-1 text-sm pr-7')}
        >
          {questions.map((x) => (
            <option key={x.id} value={x.id}>
              Q{x.n}. {x.text}
            </option>
          ))}
        </select>
        <span className="text-sm text-graphite">answers</span>
        <select aria-label="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} className={cn(controlBase, 'h-8 min-w-36 text-sm pr-7')}>
          <option value="">Choose an answer…</option>
          {q.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" type="submit" disabled={!answer}>
          Add exclusion
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
