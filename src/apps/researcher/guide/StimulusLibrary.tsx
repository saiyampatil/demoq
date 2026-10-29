import { useEffect, useRef, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button, Spinner } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { TextArea, TextField } from '@/components/Field'
import { FileIcon, PaperclipIcon, PlayIcon, PlusIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { Switch } from '@/components/Switch'
import { WizardFooter } from '@/components/WizardFooter'
import { screenById, studyPath } from '@/routes/screens'
import { uid, now } from '@/state/brief'
import { allQuestions, classifyFile, editStimuli, kindLabel, type Stimulus, type StimulusKind } from '@/state/guide'
import { PageHeader } from '../../shared/PageHeader'
import { GuideGate, VersionBanner } from './GuideBits'
import { useGuide } from './useGuide'

export function StimulusLibrary() {
  const { studyId, editable, doc, me, update, ensure, stale } = useGuide()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [card, setCard] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (editable && !doc) ensure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, doc === undefined])

  if (!editable) return <GuideGate reason="readonly" />
  if (stale) return <GuideGate reason="stale" />
  if (!doc) return null

  const items = doc.stimuli.items
  const activeCount = items.filter((i) => i.active).length
  const skipped = doc.stimuli.skipped
  const usedBy = (id: string) => (doc.guide ? allQuestions(doc.guide).filter((q) => q.stimulusId === id).length : 0)
  const edit = (fn: Parameters<typeof editStimuli>[2], note: string) => update((d) => editStimuli(d, me, fn, note))
  const add = (item: Omit<Stimulus, 'id' | 'addedAt' | 'addedBy' | 'active'>) =>
    edit((s) => ({ items: [...s.items, { ...item, id: uid('st'), active: true, addedAt: now(), addedBy: me }], skipped: false }), `Added “${item.name}” to the library`)

  const upload = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((f) => {
      const r = classifyFile(f.name, f.size)
      if ('error' in r) return setErrors((e) => [...e, r.error])
      setUploading((u) => [...u, f.name])
      // The upload itself is simulated.
      setTimeout(() => {
        add({ name: f.name.replace(/\.[^.]+$/, ''), kind: r.kind, detail: r.detail })
        setUploading((u) => u.filter((n) => n !== f.name))
      }, 900)
    })
  }

  const toggle = (s: Stimulus, on: boolean) => edit((x) => ({ ...x, items: x.items.map((i) => (i.id === s.id ? { ...i, active: on } : i)) }), `${on ? 'Activated' : 'Deactivated'} “${s.name}”`)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader id="R13" title="Stimulus library" description="Images, videos and concept cards the moderator can show. Only active items can go in the guide." />
      <VersionBanner doc={doc} />

      {skipped ? (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-base">This study uses no stimuli. The guide is drafted without a stimuli section.</p>
            <Button onClick={() => edit((x) => ({ ...x, skipped: false }), 'Stimuli step un-skipped')}>Add stimuli instead</Button>
          </div>
        </Card>
      ) : (
        <Card
          title={
            <span className="tabular-nums">
              {items.length ? `${activeCount} of ${items.length} active` : 'Library'}
            </span>
          }
          description="Switch an item off to keep it in the library without letting the moderator use it. Items are never deleted before launch."
          actions={
            <>
              <input ref={fileRef} type="file" multiple aria-label="Choose files to upload" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
              <Button size="sm" icon={<PaperclipIcon />} onClick={() => fileRef.current?.click()}>
                Upload files
              </Button>
              <Button size="sm" icon={<PlusIcon />} onClick={() => setCard(true)}>
                New concept card
              </Button>
            </>
          }
          flush
        >
          {errors.length > 0 && (
            <div className="flex flex-col gap-2 border-b border-mist p-4">
              {errors.map((e, i) => (
                <Banner
                  key={i}
                  tone="danger"
                  title="Upload failed"
                  actions={
                    <Button size="sm" onClick={() => { setErrors((x) => x.filter((_, n) => n !== i)); fileRef.current?.click() }}>
                      Upload again
                    </Button>
                  }
                >
                  {e}
                </Banner>
              ))}
            </div>
          )}
          {uploading.length > 0 && (
            <ul className="flex flex-col gap-1 border-b border-mist px-5 py-3" aria-live="polite">
              {uploading.map((n) => (
                <li key={n} className="flex items-center gap-2 text-sm text-graphite">
                  <Spinner /> Uploading {n}…
                </li>
              ))}
            </ul>
          )}
          {items.length === 0 && uploading.length === 0 ? (
            <EmptyState
              title="No stimuli yet"
              description="Upload images and videos, or write a concept card. If this study shows nothing to participants, skip this step."
              action={
                <Button onClick={() => edit((x) => ({ ...x, skipped: true }), 'Stimuli step skipped')}>This study uses no stimuli</Button>
              }
            />
          ) : (
            <ul className="divide-y divide-mist">
              {items.map((s) => {
                const used = usedBy(s.id)
                return (
                  <li key={s.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3', !s.active && 'bg-paper')}>
                    <Thumb kind={s.kind} dim={!s.active} />
                    <div className="min-w-0 flex-1 basis-56">
                      <p className={cn('font-medium', !s.active && 'text-graphite')}>{s.name}</p>
                      <p className="text-sm text-graphite">
                        {kindLabel[s.kind]} · {s.detail}
                        {used > 0 && ` · used by ${used} guide ${used === 1 ? 'question' : 'questions'}`}
                      </p>
                      {!s.active && used > 0 && <p className="text-sm text-pending-fg">The guide question{used === 1 ? '' : 's'} using it will be flagged.</p>}
                    </div>
                    {!s.active && <span className="inline-flex h-6 items-center rounded-xs border border-mist-strong bg-surface px-1.5 text-xs font-medium text-graphite">In library, not active</span>}
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-right text-sm text-graphite">{s.active ? 'On' : 'Off'}</span>
                      <Switch checked={s.active} onChange={(on) => toggle(s, on)} label={`${s.name} active`} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      {!skipped && items.length === 0 && <p className="text-sm text-graphite">Not every study needs stimuli. Skipping keeps the guide to conversation questions only.</p>}

      <WizardFooter
        previous={{ to: studyPath(studyId, screenById.R12), label: 'Moderator' }}
        message={skipped ? 'Skipped. No stimuli for this study.' : items.length ? `${activeCount} of ${items.length} active.` : undefined}
      >
        <Button variant="primary" to={studyPath(studyId, screenById.R14)}>
          Continue to guide
        </Button>
      </WizardFooter>

      <Modal
        open={card}
        onClose={() => setCard(false)}
        title="New concept card"
        description="A short written concept shown to participants as a card."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCard(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!title.trim() || !body.trim()}
              onClick={() => {
                add({ name: title.trim(), kind: 'concept', detail: `${body.trim().split(/\s+/).length} words` })
                setTitle('')
                setBody('')
                setCard(false)
              }}
            >
              Add to library
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Concept D: Overnight repair" />
          <TextArea label="Concept text" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}

function Thumb({ kind, dim }: { kind: StimulusKind; dim: boolean }) {
  return (
    <span aria-hidden="true" className={cn('flex size-12 shrink-0 items-center justify-center rounded-sm border border-mist bg-haze text-graphite', dim && 'opacity-60')}>
      {kind === 'video' ? <PlayIcon size={18} /> : kind === 'image' ? <FileIcon size={18} /> : <ConceptGlyph />}
    </span>
  )
}

// A card glyph without adding another icon: a framed page.
function ConceptGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="2.5" width="12" height="13" rx="1.5" />
      <path d="M6 6.5h6M6 9.5h6M6 12.5h3.5" />
    </svg>
  )
}
