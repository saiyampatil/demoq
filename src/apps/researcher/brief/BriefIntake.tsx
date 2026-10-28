import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Spinner } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { ArrowUpIcon, CheckIcon, FileIcon, MicIcon, PaperclipIcon, PulseMark, StopIcon } from '@/components/icons'
import { formatDateTime } from '@/lib/format'
import { briefSamples, sampleByKey } from '@/mock/briefSamples'
import { screenById, studyPath } from '@/routes/screens'
import {
  advance,
  doneLabel,
  now,
  resolveFollowUp,
  runningLabel,
  startIntake,
  stepDelay,
  uid,
  type BriefDoc,
  type ChatMessage,
  type OriginalInput,
  type SampleKey,
} from '@/state/brief'
import { PageHeader } from '../../shared/PageHeader'
import { FollowUpCard } from './FollowUpCard'
import { OriginalInputDrawer } from './OriginalInputDrawer'
import { NoBrief } from './NoBrief'
import { useBrief } from './useBrief'

const ACCEPT = '.pdf,.txt,image/*,audio/*,video/*'

export function BriefIntake() {
  const { studyId, doc, editable, me, start, update } = useBrief()
  const [sampleKey, setSampleKey] = useState<SampleKey>('complete')
  const [showOriginal, setShowOriginal] = useState(false)

  // Runs one intake step at a time. State is persisted, so a refresh picks up where it left off.
  useEffect(() => {
    if (!doc || doc.pending.length === 0) return
    const head = doc.pending[0]
    if (head === 'questions') {
      const posted = doc.chat.some((m) => m.kind === 'followups')
      if (posted && doc.followUps.some((f) => f.status === 'open')) return
    }
    const t = setTimeout(() => update(advance), stepDelay[head])
    return () => clearTimeout(t)
  }, [doc, update])

  if (!editable) return <NoBrief studyId={studyId} editable={false} />

  const begin = (original: OriginalInput, first: ChatMessage) => start(startIntake(studyId, sampleByKey[sampleKey], original, first))
  const sample = sampleByKey[sampleKey]

  const sendText = (text: string) => {
    const at = now()
    begin(
      { kind: 'text', label: 'Typed brief', from: me, receivedAt: at, text, textLabel: 'Typed text' },
      { id: uid('m'), at, role: 'researcher', kind: 'text', text },
    )
  }

  const sendFile = (file: File) => {
    const at = now()
    const isRecording = file.type.startsWith('audio/') || file.type.startsWith('video/')
    begin(
      {
        kind: isRecording ? 'audio' : 'file',
        label: isRecording ? 'Uploaded recording' : 'Uploaded file',
        fileName: file.name,
        from: me,
        receivedAt: at,
        // The prototype doesn't read files: the selected sample stands in for the extracted text or transcript.
        text: sample.original.text,
        textLabel: isRecording ? 'Transcript' : 'Extracted text',
      },
      { id: uid('m'), at, role: 'researcher', kind: 'file', fileName: file.name, fileType: file.type || 'file' },
    )
  }

  const sendVoice = (duration: string) => {
    const at = now()
    begin(
      { kind: 'voice', label: 'Voice note', duration, from: me, receivedAt: at, text: sample.original.text, textLabel: 'Transcript' },
      { id: uid('m'), at, role: 'researcher', kind: 'voice', duration },
    )
  }

  const sendSample = () => {
    const at = now()
    const o = { ...sample.original, receivedAt: at }
    begin(
      o,
      o.kind === 'audio'
        ? { id: uid('m'), at, role: 'researcher', kind: 'file', fileName: o.fileName ?? 'recording.m4a', fileType: 'audio/mp4' }
        : { id: uid('m'), at, role: 'researcher', kind: 'text', text: o.text },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        id="R1"
        title="Brief intake"
        description="Add the client’s brief. The AI turns it into a seven-section draft and asks only what it can’t work out."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          {import.meta.env.DEV && !doc && <SamplePicker value={sampleKey} onChange={setSampleKey} onSend={sendSample} />}

          <Card flush>
            <div className="flex min-h-[360px] flex-col">
              <div className="flex flex-1 flex-col gap-5 px-5 py-5" aria-live="polite">
                {!doc ? <ChatIntro /> : <ChatThread doc={doc} onResolve={(id, status, answer) => update((d) => resolveFollowUp(d, id, status, me, answer))} />}
              </div>
              <div className="border-t border-mist p-3">
                {doc?.intakeComplete ? (
                  <div className="flex flex-wrap items-center gap-3 px-1 py-1">
                    <p className="flex-1 text-sm text-graphite">The brief is drafted. Keep editing it in the brief editor.</p>
                    <Button variant="primary" to={studyPath(studyId, screenById.R4)}>
                      Open brief editor
                    </Button>
                  </div>
                ) : (
                  <Composer disabled={Boolean(doc)} onText={sendText} onFile={sendFile} onVoice={sendVoice} />
                )}
              </div>
            </div>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card title="Original input">
            {doc ? (
              <div className="flex flex-col gap-3">
                <div className="text-sm">
                  <div className="font-medium">{doc.original.label}</div>
                  {doc.original.fileName && <div className="text-graphite">{doc.original.fileName}</div>}
                  <div className="text-graphite tabular-nums">{formatDateTime(doc.original.receivedAt)}</div>
                </div>
                <p className="line-clamp-6 text-sm whitespace-pre-wrap text-graphite">{doc.original.text}</p>
                <p className="text-xs text-muted">Read-only. Kept unchanged beside every version.</p>
                <Button size="sm" onClick={() => setShowOriginal(true)}>
                  View original input
                </Button>
              </div>
            ) : (
              <p className="text-sm text-graphite">Whatever you send is stored here exactly as received. Edits to the brief never change it.</p>
            )}
          </Card>
        </aside>
      </div>

      {doc && (
        <OriginalInputDrawer open={showOriginal} onClose={() => setShowOriginal(false)} original={doc.original} previousResearch={doc.previousResearch} />
      )}
    </div>
  )
}

function ChatIntro() {
  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-2 py-8 text-center">
      <PulseMark size={28} />
      <h2 className="mt-1 text-md font-semibold">Start with whatever the client sent</h2>
      <p className="text-graphite">
        Paste or type the brief, upload a file (PDF, TXT, an image, or an audio or video recording), or record a voice note.
      </p>
    </div>
  )
}

function SamplePicker({ value, onChange, onSend }: { value: SampleKey; onChange: (k: SampleKey) => void; onSend: () => void }) {
  return (
    <section className="rounded-md border border-dashed border-mist-strong bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Sample input</h2>
        <span className="rounded-xs bg-haze px-1.5 text-xs text-graphite">Dev only</span>
      </div>
      <p className="mt-0.5 text-xs text-graphite">
        Pick a mock input and send it. Anything you type, upload or record also uses the selected sample’s outputs.
      </p>
      <fieldset className="mt-3 grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">Sample input</legend>
        {briefSamples.map((s) => (
          <label
            key={s.key}
            className={cn(
              'flex cursor-pointer gap-2 rounded-sm border px-3 py-2',
              value === s.key ? 'border-ink bg-paper' : 'border-mist hover:border-mist-strong',
            )}
          >
            <input type="radio" name="sample" className="mt-1 accent-[var(--color-iris-600)]" checked={value === s.key} onChange={() => onChange(s.key)} />
            <span>
              <span className="block text-sm font-medium">{s.label}</span>
              <span className="block text-xs text-graphite">{s.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Button className="mt-3" size="sm" onClick={onSend}>
        Send sample input
      </Button>
    </section>
  )
}

function Composer({ disabled, onText, onFile, onVoice }: { disabled: boolean; onText: (t: string) => void; onFile: (f: File) => void; onVoice: (d: string) => void }) {
  const [text, setText] = useState('')
  const [recordingSince, setRecordingSince] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (recordingSince === null) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - recordingSince) / 1000)), 250)
    return () => clearInterval(t)
  }, [recordingSince])

  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`

  if (recordingSince !== null) {
    return (
      <div className="flex items-center gap-3 rounded-sm bg-paper px-3 py-2">
        <span className="size-2.5 rounded-full bg-negative-fg motion-safe:animate-pulse" aria-hidden="true" />
        <span className="flex-1 text-sm">
          Recording voice note <span className="text-graphite tabular-nums">{clock}</span>
          <span className="ml-2 text-xs text-muted">(simulated)</span>
        </span>
        <Button size="sm" variant="ghost" onClick={() => setRecordingSince(null)}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<StopIcon />}
          onClick={() => {
            setRecordingSince(null)
            onVoice(clock === '0:00' ? '0:01' : clock)
          }}
        >
          Stop and send
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) onText(text.trim())
      }}
    >
      <label htmlFor="brief-input" className="sr-only">
        Brief text
      </label>
      <textarea
        id="brief-input"
        rows={3}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) onText(text.trim())
        }}
        placeholder={disabled ? 'Processing your input…' : 'Paste or type the client’s brief'}
        className="w-full resize-none rounded-sm border border-transparent bg-transparent px-2 py-1.5 text-base placeholder:text-muted focus:border-iris-600 disabled:text-muted"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
        <Button size="sm" icon={<PaperclipIcon />} disabled={disabled} onClick={() => fileRef.current?.click()}>
          Upload file
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<MicIcon />}
          disabled={disabled}
          onClick={() => {
            setElapsed(0)
            setRecordingSince(Date.now())
          }}
        >
          Record voice note
        </Button>
        <span className="ml-auto hidden text-xs text-muted sm:inline">PDF, TXT, images, audio or video</span>
        <Button type="submit" size="sm" variant="primary" icon={<ArrowUpIcon />} disabled={disabled || !text.trim()}>
          Send
        </Button>
      </div>
    </form>
  )
}

function ChatThread({ doc, onResolve }: { doc: BriefDoc; onResolve: (id: string, status: 'answered' | 'skipped' | 'assumed', answer?: string) => void }) {
  const head = doc.pending[0]
  const showRunning = head && !(head === 'questions' && doc.chat.some((m) => m.kind === 'followups'))
  return (
    <>
      {doc.chat.map((m) => (
        <Message key={m.id} message={m} doc={doc} onResolve={onResolve} />
      ))}
      {showRunning && (
        <AiRow>
          <div className="flex items-center gap-2 text-graphite">
            <Spinner />
            <span>{runningLabel[head]}…</span>
          </div>
        </AiRow>
      )}
    </>
  )
}

function AiRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0">
        <PulseMark size={20} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function Message({ message: m, doc, onResolve }: { message: ChatMessage; doc: BriefDoc; onResolve: (id: string, status: 'answered' | 'skipped' | 'assumed', answer?: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  if (m.role === 'researcher') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-md bg-haze px-3.5 py-2.5">
          {m.kind === 'text' && (
            <>
              <p className={cn('whitespace-pre-wrap', !expanded && 'line-clamp-6')}>{m.text}</p>
              {m.text.split('\n').length > 6 && (
                <button type="button" className="mt-1 rounded-xs text-sm text-graphite underline" onClick={() => setExpanded((x) => !x)}>
                  {expanded ? 'Show less' : 'Show all'}
                </button>
              )}
            </>
          )}
          {m.kind === 'file' && (
            <span className="flex items-center gap-2">
              <FileIcon className="text-graphite" />
              <span className="font-medium">{m.fileName}</span>
            </span>
          )}
          {m.kind === 'voice' && (
            <span className="flex items-center gap-2">
              <MicIcon className="text-graphite" />
              Voice note, {m.duration}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (m.kind === 'step') {
    return (
      <AiRow>
        <p className="flex items-center gap-1.5 font-medium">
          <CheckIcon className="text-positive-fg" />
          {doneLabel[m.step]}
        </p>
        <p className="mt-0.5 text-graphite">{m.detail}</p>
        {m.items && (
          <ul className="mt-1.5 flex list-disc flex-col gap-0.5 pl-5 text-sm text-graphite">
            {m.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {m.sources && m.sources.length > 0 && (
          <div className="mt-2 rounded-md border border-mist bg-paper p-3">
            <p className="text-xs font-semibold text-graphite">Sources</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {m.sources.map((s) => (
                <li key={s.url} className="text-sm">
                  <span className="font-medium">{s.title}</span>
                  <span className="text-graphite">, {s.publisher}</span>
                  <span className="block text-xs break-all text-muted">{s.url}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AiRow>
    )
  }

  if (m.kind === 'text') return <AiRow>{m.text}</AiRow>

  if (m.kind === 'followups') {
    return (
      <AiRow>
        <div className="flex flex-col gap-3">
          {doc.followUps.map((f) => (
            <FollowUpCard key={f.id} followUp={f} onResolve={(status, answer) => onResolve(f.id, status, answer)} />
          ))}
        </div>
      </AiRow>
    )
  }

  return (
    <AiRow>
      <div className="rounded-md border border-mist bg-paper p-4">
        <p className="font-medium">Version 1 is ready in the brief editor</p>
        <p className="mt-0.5 text-sm text-graphite">Review the AI-generated sections, fill anything missing, then save a version.</p>
      </div>
    </AiRow>
  )
}
