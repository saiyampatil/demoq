import { useEffect, useRef, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button, Spinner } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { TextArea, TextField } from '@/components/Field'
import { FileIcon, PaperclipIcon, PlayIcon, PlusIcon, SurveyIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { EmptyState } from '@/components/States'
import { Switch } from '@/components/Switch'
import { WizardFooter } from '@/components/WizardFooter'
import { screenById, studyPath } from '@/routes/screens'
import { uid, now } from '@/state/brief'
import { FORMAT_LABEL, type SurveyDef } from '@/mock/surveys'
import { allQuestions, classifyCardImage, classifyFile, editStimuli, kindLabel, newSurveyItem, questionsOfSurvey, surveyFormats, type Stimulus, type StimulusKind } from '@/state/guide'
import { PageHeader } from '../../shared/PageHeader'
import { GuideGate, VersionBanner } from './GuideBits'
import { SurveyBuilder } from './SurveyBuilder'
import { useGuide } from './useGuide'

export function StimulusLibrary() {
  const { studyId, editable, doc, me, update, ensure, stale } = useGuide()
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const [replacing, setReplacing] = useState<string>()
  const [uploading, setUploading] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [card, setCard] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [cardImage, setCardImage] = useState<{ file: File; preview: string }>()
  const [cardError, setCardError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const cardFileRef = useRef<HTMLInputElement>(null)
  const [survey, setSurvey] = useState(false)
  const [openSurvey, setOpenSurvey] = useState<string>()

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
  const addSurvey = (def: SurveyDef) => {
    const item = newSurveyItem(def, me)
    edit((x) => ({ items: [...x.items, item], skipped: false }), `Added survey “${item.name}”`)
    setSurvey(false)
  }

  const closeCard = () => {
    setCard(false)
    setTitle('')
    setBody('')
    setCardImage(undefined)
    setCardError(undefined)
  }
  const pickCardImage = async (f: File | undefined) => {
    if (!f) return
    const r = classifyCardImage(f.name, f.size)
    if ('error' in r) return setCardError(r.error)
    try {
      setCardImage({ file: f, preview: await previewOf(f) })
      setCardError(undefined)
    } catch {
      setCardError(`“${f.name}” couldn’t be read as an image. Choose another file.`)
    }
  }
  const saveCard = () => {
    setSaving(true)
    // Adding the card is simulated, like an upload.
    setTimeout(() => {
      const words = body.trim().split(/\s+/).length
      add({ name: title.trim(), kind: 'concept', detail: `${cardImage ? 'Image and ' : ''}${words} words`, text: body.trim(), ...(cardImage ? { image: cardImage.preview } : {}) })
      setSaving(false)
      closeCard()
    }, 600)
  }

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

  // Mock: a replaced file renders. Replacing a file on an active stimulus is an edit to the active set.
  const replaceFile = (s: Stimulus, f: File | undefined) => {
    if (!f) return
    const r = classifyFile(f.name, f.size)
    if ('error' in r) return setErrors((e) => [...e, r.error])
    setUploading((u) => [...u, f.name])
    setTimeout(() => {
      edit((x) => ({ ...x, items: x.items.map((i) => (i.id === s.id ? { ...i, renderOk: true, detail: r.detail } : i)) }), `Replaced the file for “${s.name}”`)
      setUploading((u) => u.filter((n) => n !== f.name))
    }, 900)
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
              <input ref={replaceRef} type="file" aria-label="Choose a replacement file" className="hidden" onChange={(e) => { const s = items.find((i) => i.id === replacing); if (s) replaceFile(s, e.target.files?.[0]); e.target.value = '' }} />
              <input ref={fileRef} type="file" multiple aria-label="Choose files to upload" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
              <Button size="sm" icon={<PaperclipIcon />} onClick={() => fileRef.current?.click()}>
                Upload files
              </Button>
              <Button size="sm" icon={<PlusIcon />} onClick={() => setCard(true)}>
                New concept card
              </Button>
              <Button size="sm" icon={<SurveyIcon />} onClick={() => setSurvey(true)}>
                New survey
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
              description="Upload images and videos, or write a concept card with a picture and a description. If this study shows nothing to participants, skip this step."
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
                    <Thumb kind={s.kind} image={s.image} dim={!s.active} />
                    <div className="min-w-0 flex-1 basis-56">
                      <p className={cn('font-medium', !s.active && 'text-graphite')}>{s.name}</p>
                      <p className="text-sm text-graphite">
                        {s.kind === 'survey' ? `Survey · ${questionsOfSurvey(s).length} ${questionsOfSurvey(s).length === 1 ? 'question' : 'questions'} · ${surveyFormats(questionsOfSurvey(s)).map((f) => FORMAT_LABEL[f].toLowerCase()).join(', ')}` : `${kindLabel[s.kind]} · ${s.detail}`}
                        {used > 0 && ` · used by ${used} guide ${used === 1 ? 'question' : 'questions'}`}
                      </p>
                      {s.kind === 'survey' && (
                        <>
                          <button type="button" aria-expanded={openSurvey === s.id} onClick={() => setOpenSurvey((x) => (x === s.id ? undefined : s.id))} className="mt-0.5 rounded-xs text-sm font-medium text-iris-700 hover:underline">
                            {openSurvey === s.id ? 'Hide questions' : 'Show questions'}
                          </button>
                          {openSurvey === s.id && (
                            <ol className="mt-2 flex max-w-prose flex-col gap-2.5 rounded-sm border border-mist bg-paper p-3 text-sm" data-testid="survey-questions">
                              {questionsOfSurvey(s).map((q, n) => (
                                <li key={q.id}>
                                  <p className="font-medium">
                                    <span className="mr-1.5 text-graphite tabular-nums">{n + 1}.</span>
                                    {q.text}
                                  </p>
                                  <p className="text-xs text-graphite">
                                    {q.format === 'rating' ? `Rating 1 to ${q.options.length}${q.scale ? `. 1 = ${q.scale.low || '…'}, ${q.options.length} = ${q.scale.high || '…'}` : ''}` : `${FORMAT_LABEL[q.format]}. ${q.options.join(' · ')}`}
                                  </p>
                                </li>
                              ))}
                            </ol>
                          )}
                        </>
                      )}
                      {s.text && <p className="mt-0.5 line-clamp-2 max-w-prose text-sm text-ink">{s.text}</p>}
                      {s.renderOk === false && <p className="text-sm text-negative-fg">This file fails to render. Replace it so participants can see it.</p>}
                      {!s.active && used > 0 && <p className="text-sm text-pending-fg">The guide question{used === 1 ? '' : 's'} using it will be flagged.</p>}
                    </div>
                    {s.renderOk === false && (
                      <Button size="sm" onClick={() => { setReplacing(s.id); replaceRef.current?.click() }}>
                        Replace file
                      </Button>
                    )}
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
        onClose={closeCard}
        title="New concept card"
        description="One card the participant sees: a picture and a short description."
        footer={
          <>
            <Button variant="ghost" onClick={closeCard}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!title.trim() || !body.trim()} loading={saving} onClick={saveCard}>
              Add to library
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Concept D: Overnight repair" />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Picture (optional)</span>
            <input ref={cardFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose a picture for the card" className="hidden" data-testid="card-image-input" onChange={(e) => { void pickCardImage(e.target.files?.[0]); e.target.value = '' }} />
            {cardImage ? (
              <div className="flex items-center gap-3 rounded-sm border border-mist p-2">
                <img src={cardImage.preview} alt="" className="size-16 rounded-xs object-cover" data-testid="card-image-preview" />
                <p className="min-w-0 flex-1 truncate text-sm">{cardImage.file.name}</p>
                <Button size="sm" onClick={() => cardFileRef.current?.click()}>
                  Replace
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCardImage(undefined)}>
                  Remove
                </Button>
              </div>
            ) : (
              <Button className="self-start" icon={<PaperclipIcon />} onClick={() => cardFileRef.current?.click()}>
                Add a picture
              </Button>
            )}
            {cardError ? (
              <p role="alert" className="text-sm text-negative-fg">
                {cardError}
              </p>
            ) : (
              <p className="text-xs text-graphite">PNG, JPG, WebP or GIF, up to 200 MB. Leave it out for a text-only card.</p>
            )}
          </div>
          <TextArea label="Description" rows={5} value={body} onChange={(e) => setBody(e.target.value)} hint="What the participant reads next to the picture." />
        </div>
      </Modal>
      <SurveyBuilder open={survey} onClose={() => setSurvey(false)} onAdd={addSurvey} />
    </div>
  )
}

/** A small preview of a picture, so a card in the library keeps its image without storing the whole file. */
function previewOf(file: File, max = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * scale))
      c.height = Math.max(1, Math.round(img.height * scale))
      const ctx = c.getContext('2d')
      if (!ctx) return reject(new Error('no canvas'))
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('bad image'))
    }
    img.src = url
  })
}

function Thumb({ kind, image, dim }: { kind: StimulusKind; image?: string; dim: boolean }) {
  if (image) return <img src={image} alt="" className={cn('size-12 shrink-0 rounded-sm border border-mist object-cover', dim && 'opacity-60')} />
  return (
    <span aria-hidden="true" className={cn('flex size-12 shrink-0 items-center justify-center rounded-sm border border-mist bg-haze text-graphite', dim && 'opacity-60')}>
      {kind === 'video' ? <PlayIcon size={18} /> : kind === 'image' ? <FileIcon size={18} /> : kind === 'survey' ? <SurveyIcon size={18} /> : <ConceptGlyph />}
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
