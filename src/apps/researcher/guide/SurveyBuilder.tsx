import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'
import { controlBase, TextArea, TextField } from '@/components/Field'
import { CloseIcon, PlusIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { FORMAT_HINT, FORMAT_LABEL, ratingOptions, SURVEY_LIMITS, type SurveyDef, type SurveyFormat } from '@/mock/surveys'
import { surveyProblems } from '@/state/guide'

type Draft = { key: string; text: string; format: SurveyFormat; options: string[]; points: number; low: string; high: string; touched: boolean }

let seq = 0
const blank = (): Draft => ({ key: `d${++seq}`, text: '', format: 'single', options: ['', ''], points: 5, low: '', high: '', touched: false })
const FORMATS: SurveyFormat[] = ['single', 'multiple', 'rating']

/** Builds one survey: a title and questions in the order they'll be shown. Nothing is saved until Add to library. */
export function SurveyBuilder({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (def: SurveyDef) => void }) {
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [qs, setQs] = useState<Draft[]>([blank()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setTitleTouched(false)
    setQs([blank()])
    setSaving(false)
  }, [open])

  const set = (key: string, fn: (d: Draft) => Draft) => setQs((all) => all.map((d) => (d.key === key ? { ...fn(d), touched: true } : d)))
  const move = (i: number, by: -1 | 1) =>
    setQs((all) => {
      const next = [...all]
      const j = i + by
      if (j < 0 || j >= next.length) return all
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const def = (): SurveyDef => ({
    title,
    questions: qs.map((d, i) => ({
      id: `q${i + 1}`,
      text: d.text,
      format: d.format,
      options: d.format === 'rating' ? ratingOptions(d.points) : d.options,
      ...(d.format === 'rating' ? { scale: { low: d.low, high: d.high } } : {}),
    })),
  })
  const problems = surveyProblems(def())
  const firstProblem = problems.title ?? Object.entries(problems.questions).map(([i, m]) => `Question ${Number(i) + 1}: ${m}`)[0]
  const full = qs.length >= SURVEY_LIMITS.questions

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New survey"
      description="A short set of questions shown on screen during the interview. Wording and answers are fixed once it’s in the library."
      footer={
        <>
          <p className={cn('mr-auto self-center text-sm', firstProblem ? 'text-graphite' : 'text-positive-fg')} aria-live="polite">
            {firstProblem ?? `${qs.length} ${qs.length === 1 ? 'question' : 'questions'}, ready to add.`}
          </p>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={problems.any}
            loading={saving}
            data-testid="survey-add"
            onClick={() => {
              setSaving(true)
              setTimeout(() => {
                onAdd(def())
                setSaving(false)
              }, 400)
            }}
          >
            Add to library
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-1" data-testid="survey-builder">
        <TextField label="Survey title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setTitleTouched(true)} placeholder="e.g. Concept reaction" error={titleTouched ? problems.title : undefined} hint="Researchers see this. Participants don’t." data-testid="survey-title" />

        <ol className="flex flex-col gap-4">
          {qs.map((d, i) => {
            const err = d.touched ? problems.questions[i] : undefined
            return (
              <li key={d.key} className="rounded-md border border-mist bg-paper p-4" data-testid="survey-question">
                <div className="flex items-center gap-1">
                  <h3 className="mr-auto text-sm font-semibold">Question {i + 1}</h3>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move question ${i + 1} up`} className="rounded-xs px-1.5 py-0.5 text-graphite hover:bg-haze hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === qs.length - 1} aria-label={`Move question ${i + 1} down`} className="rounded-xs px-1.5 py-0.5 text-graphite hover:bg-haze hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent">
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setQs((all) => all.filter((x) => x.key !== d.key))}
                    disabled={qs.length === 1}
                    className="ml-1 rounded-xs px-1.5 py-0.5 text-sm text-graphite hover:bg-haze hover:text-negative-fg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-graphite"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-2 flex flex-col gap-3">
                  <TextArea label="Question" rows={2} value={d.text} onChange={(e) => set(d.key, (x) => ({ ...x, text: e.target.value }))} containerClassName="[&>textarea]:bg-surface" />

                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium">Answer type</legend>
                    <div role="radiogroup" className="inline-flex rounded-sm border border-mist-strong bg-haze p-0.5">
                      {FORMATS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          role="radio"
                          aria-checked={d.format === f}
                          onClick={() => set(d.key, (x) => ({ ...x, format: f }))}
                          className={cn('rounded-xs px-3 py-1 text-sm', d.format === f ? 'bg-surface font-semibold text-ink shadow-raised' : 'text-graphite hover:text-ink')}
                        >
                          {FORMAT_LABEL[f]}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-graphite">{FORMAT_HINT[d.format]}.</p>
                  </fieldset>

                  {d.format === 'rating' ? (
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Scale</span>
                        <select value={d.points} onChange={(e) => set(d.key, (x) => ({ ...x, points: Number(e.target.value) }))} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
                          {SURVEY_LIMITS.scalePoints.map((p) => (
                            <option key={p} value={p}>
                              1 to {p}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField label={`1 means`} value={d.low} onChange={(e) => set(d.key, (x) => ({ ...x, low: e.target.value }))} placeholder="e.g. Not at all appealing" />
                        <TextField label={`${d.points} means`} value={d.high} onChange={(e) => set(d.key, (x) => ({ ...x, high: e.target.value }))} placeholder="e.g. Very appealing" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">Answers</span>
                      <ul className="flex flex-col gap-1.5">
                        {d.options.map((o, k) => (
                          <li key={k} className="flex items-center gap-1.5">
                            <input
                              aria-label={`Question ${i + 1}, answer ${k + 1}`}
                              value={o}
                              onChange={(e) => set(d.key, (x) => ({ ...x, options: x.options.map((v, n) => (n === k ? e.target.value : v)) }))}
                              placeholder={`Answer ${k + 1}`}
                              className={cn(controlBase, 'h-9 min-w-0 flex-1 bg-surface')}
                            />
                            <button
                              type="button"
                              onClick={() => set(d.key, (x) => ({ ...x, options: x.options.filter((_, n) => n !== k) }))}
                              disabled={d.options.length <= SURVEY_LIMITS.minOptions}
                              aria-label={`Remove answer ${k + 1} from question ${i + 1}`}
                              className="rounded-xs p-1.5 text-graphite hover:bg-haze hover:text-negative-fg disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-graphite"
                            >
                              <CloseIcon size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <Button size="sm" className="self-start" icon={<PlusIcon size={12} />} disabled={d.options.length >= SURVEY_LIMITS.maxOptions} onClick={() => set(d.key, (x) => ({ ...x, options: [...x.options, ''] }))}>
                        Add answer
                      </Button>
                    </div>
                  )}

                  {err && (
                    <p role="alert" className="text-sm text-negative-fg">
                      {err}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        <div className="flex items-center gap-3">
          <Button icon={<PlusIcon size={14} />} disabled={full} onClick={() => setQs((all) => [...all, blank()])} data-testid="survey-add-question">
            Add question
          </Button>
          {full && <span className="text-sm text-graphite">A survey can have up to {SURVEY_LIMITS.questions} questions.</span>}
        </div>
      </div>
    </Modal>
  )
}
